import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CostNature,
  Essentiality,
  PaymentMethod,
  Prisma,
  TransactionStatus,
  TransactionType
} from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import {
  endOfMonth,
  isInflow,
  isOutflow,
  labelForEnum,
  labelForTransactionStatus,
  labelForTransactionType,
  mapTransactionStatus,
  parseTags,
  startOfMonth,
  toDirection,
  toNumber
} from "../../common/finance.utils";
import { OwnershipService } from "../../common/ownership.service";
import { PrismaService } from "../../common/prisma.service";
import { ProductAnalyticsService } from "../../common/product-analytics.service";
import { AccountsService } from "../accounts/accounts.service";

interface TransactionInput {
  accountId?: string;
  counterpartyAccountId?: string;
  cardId?: string;
  categoryId?: string;
  subcategoryId?: string;
  type: TransactionType;
  status?: TransactionStatus;
  description: string;
  amount: number;
  postedAt: string;
  dueDate?: string;
  paymentMethod?: PaymentMethod;
  costNature?: CostNature;
  essentiality?: Essentiality;
  notes?: string;
  tags?: string[];
}

interface TransactionListQuery {
  page?: string;
  pageSize?: string;
  search?: string;
  status?: string;
  direction?: string;
  categoryId?: string;
  subcategoryId?: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private readonly accountsService: AccountsService,
    private readonly analytics: ProductAnalyticsService
  ) {}

  async list(auth: AuthenticatedRequestContext, query?: TransactionListQuery) {
    const page = Math.max(Number(query?.page ?? 1) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query?.pageSize ?? 20) || 20, 1), 100);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const where: Prisma.TransactionWhereInput = {
      userId: auth.userId,
      status: query?.status && query.status !== "ALL"
        ? query.status as TransactionStatus
        : {
            not: "CANCELED"
          },
      description: query?.search
        ? {
            contains: query.search,
            mode: "insensitive"
          }
        : undefined,
      categoryId: query?.categoryId || undefined,
      subcategoryId: query?.subcategoryId || undefined,
      type: this.mapDirectionFilter(query?.direction)
    };

    const [items, totalItems, summaryItems] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          account: true,
          card: true,
          category: true,
          subcategory: true
        },
        orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }]
      })
    ]);

    const currentMonthTransactions = summaryItems.filter(
      (item) => item.postedAt >= monthStart && item.postedAt <= monthEnd
    );

    return {
      summary: {
        income: currentMonthTransactions
          .filter((item) => isInflow(item.type) && item.status === "CLEARED")
          .reduce((sum, item) => sum + toNumber(item.amount), 0),
        expenses: currentMonthTransactions
          .filter((item) => isOutflow(item.type) && item.status === "CLEARED")
          .reduce((sum, item) => sum + toNumber(item.amount), 0),
        planned: currentMonthTransactions
          .filter((item) => item.status === "PLANNED" || item.status === "PENDING")
          .reduce((sum, item) => sum + toNumber(item.amount), 0)
      },
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(Math.ceil(totalItems / pageSize), 1)
      },
      items: items.map((item) => this.toPublicTransaction(item))
    };
  }

  async create(auth: AuthenticatedRequestContext, input: TransactionInput) {
    this.validate(input);
    const refs = await this.ownership.resolveTransactionRefs(auth.userId, {
      accountId: input.accountId ?? null,
      counterpartyAccountId: input.counterpartyAccountId ?? null,
      cardId: input.cardId ?? null,
      categoryId: input.categoryId ?? null,
      subcategoryId: input.subcategoryId ?? null,
      type: input.type
    });
    const amount = new Prisma.Decimal(input.amount);
    const status = input.status ?? "CLEARED";

    const record = await this.prisma.transaction.create({
      data: {
        userId: auth.userId,
        accountId: refs.accountId,
        counterpartyAccountId: refs.counterpartyAccountId,
        cardId: refs.cardId,
        categoryId: refs.categoryId,
        subcategoryId: refs.subcategoryId,
        createdByUserId: auth.userId,
        type: input.type,
        status,
        source: "MANUAL",
        description: input.description.trim(),
        amount,
        postedAt: new Date(input.postedAt),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        paymentMethod: input.paymentMethod ?? null,
        costNature: input.costNature ?? null,
        essentiality: input.essentiality ?? null,
        notes: input.notes ?? null,
        tags: input.tags ?? []
      },
      include: {
        account: true,
        card: true,
        category: true,
        subcategory: true
      }
    });

    await this.recalculateAffectedAccounts(record.accountId, record.counterpartyAccountId);

    if (isInflow(record.type)) {
      const incomeTransactionsCount = await this.prisma.transaction.count({
        where: {
          userId: auth.userId,
          status: {
            not: "CANCELED"
          },
          type: {
            in: ["INCOME", "REFUND"]
          }
        }
      });

      if (incomeTransactionsCount === 1) {
        await this.analytics.recordOnceForUser({
          userId: auth.userId,
          sessionId: auth.sessionId,
          name: "FIRST_INCOME_CREATED",
          pagePath: "/transactions",
          metadata: {
            type: record.type,
            amount: toNumber(record.amount)
          }
        });
      }
    }

    if (isOutflow(record.type)) {
      const expenseTransactionsCount = await this.prisma.transaction.count({
        where: {
          userId: auth.userId,
          status: {
            not: "CANCELED"
          },
          type: {
            in: [
              "EXPENSE",
              "CREDIT_CARD_PAYMENT",
              "GOAL_CONTRIBUTION",
              "INVESTMENT",
              "LIABILITY_PAYMENT",
              "CREDIT_CARD_PURCHASE"
            ]
          }
        }
      });

      if (expenseTransactionsCount === 1) {
        await this.analytics.recordOnceForUser({
          userId: auth.userId,
          sessionId: auth.sessionId,
          name: "FIRST_EXPENSE_CREATED",
          pagePath: "/transactions",
          metadata: {
            type: record.type,
            amount: toNumber(record.amount)
          }
        });
      }
    }

    return this.toPublicTransaction(record);
  }

  async update(
    auth: AuthenticatedRequestContext,
    transactionId: string,
    input: Partial<TransactionInput>
  ) {
    const existing = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId: auth.userId,
        status: {
          not: "CANCELED"
        }
      },
      include: {
        account: true,
        card: true,
        category: true,
        subcategory: true
      }
    });

    if (!existing) {
      throw new NotFoundException("Transacao nao encontrada.");
    }

    const refs = await this.ownership.resolveTransactionRefs(auth.userId, {
      accountId: input.accountId !== undefined ? input.accountId || null : existing.accountId,
      counterpartyAccountId:
        input.counterpartyAccountId !== undefined
          ? input.counterpartyAccountId || null
          : existing.counterpartyAccountId,
      cardId: input.cardId !== undefined ? input.cardId || null : existing.cardId,
      categoryId:
        input.categoryId !== undefined ? input.categoryId || null : existing.categoryId,
      subcategoryId:
        input.subcategoryId !== undefined
          ? input.subcategoryId || null
          : existing.subcategoryId,
      type: input.type ?? existing.type
    });

    await this.prisma.transaction.update({
      where: { id: existing.id },
      data: {
        accountId: refs.accountId,
        counterpartyAccountId: refs.counterpartyAccountId,
        cardId: refs.cardId,
        categoryId: refs.categoryId,
        subcategoryId: refs.subcategoryId,
        type: input.type ?? existing.type,
        status: input.status ?? existing.status,
        description: input.description?.trim() || existing.description,
        amount:
          input.amount !== undefined ? new Prisma.Decimal(input.amount) : existing.amount,
        postedAt: input.postedAt ? new Date(input.postedAt) : existing.postedAt,
        dueDate:
          input.dueDate !== undefined
            ? input.dueDate
              ? new Date(input.dueDate)
              : null
            : existing.dueDate,
        paymentMethod:
          input.paymentMethod !== undefined ? input.paymentMethod || null : existing.paymentMethod,
        costNature:
          input.costNature !== undefined ? input.costNature || null : existing.costNature,
        essentiality:
          input.essentiality !== undefined
            ? input.essentiality || null
            : existing.essentiality,
        notes: input.notes !== undefined ? input.notes || null : existing.notes,
        ...(input.tags !== undefined ? { tags: input.tags } : {})
      }
    });

    const updated = await this.prisma.transaction.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        account: true,
        card: true,
        category: true,
        subcategory: true
      }
    });

    await this.recalculateAffectedAccounts(
      existing.accountId,
      existing.counterpartyAccountId,
      updated.accountId,
      updated.counterpartyAccountId
    );

    return this.toPublicTransaction(updated);
  }

  async cancel(auth: AuthenticatedRequestContext, transactionId: string) {
    const existing = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId: auth.userId,
        status: {
          not: "CANCELED"
        }
      }
    });

    if (!existing) {
      throw new NotFoundException("Transacao nao encontrada.");
    }

    await this.prisma.transaction.update({
      where: { id: existing.id },
      data: {
        status: "CANCELED"
      }
    });

    await this.recalculateAffectedAccounts(existing.accountId, existing.counterpartyAccountId);
    return { success: true };
  }

  private toPublicTransaction(item: {
    id: string;
    postedAt: Date;
    description: string;
    category: { id: string; name: string } | null;
    subcategory: { id: string; name: string } | null;
    type: TransactionType;
    status: TransactionStatus;
    amount: Prisma.Decimal;
    account: { id: string; name: string } | null;
    card: { id: string; name: string } | null;
    paymentMethod: PaymentMethod | null;
    tags: Prisma.JsonValue | null;
    costNature: CostNature | null;
    essentiality: Essentiality | null;
    notes: string | null;
  }) {
    return {
      id: item.id,
      date: item.postedAt.toISOString().slice(0, 10),
      description: item.description,
      type: labelForTransactionType(item.type),
      typeCode: item.type,
      statusCode: item.status,
      status: labelForTransactionStatus(item.status),
      direction: toDirection(item.type),
      statusTone: mapTransactionStatus(item.status),
      amount: toNumber(item.amount),
      category: item.category?.name ?? "Sem categoria",
      categoryId: item.category?.id ?? null,
      subcategory: item.subcategory?.name ?? "Sem subcategoria",
      subcategoryId: item.subcategory?.id ?? null,
      account: item.account?.name ?? item.card?.name ?? "Sem conta",
      accountId: item.account?.id ?? null,
      cardId: item.card?.id ?? null,
      paymentMethod: labelForEnum(item.paymentMethod),
      paymentMethodCode: item.paymentMethod ?? "OTHER",
      nature: labelForEnum(item.costNature),
      natureCode: item.costNature ?? null,
      essentiality: labelForEnum(item.essentiality),
      essentialityCode: item.essentiality ?? null,
      tags: parseTags(item.tags),
      notes: item.notes ?? ""
    };
  }

  private async recalculateAffectedAccounts(...accountIds: Array<string | null | undefined>) {
    const uniqueIds = [...new Set(accountIds.filter(Boolean))] as string[];

    await Promise.all(uniqueIds.map((accountId) => this.accountsService.recalculateBalance(accountId)));
  }

  private validate(input: TransactionInput) {
    if (!input.description?.trim()) {
      throw new BadRequestException("Descricao da transacao obrigatoria.");
    }

    if (input.amount === undefined || Number.isNaN(input.amount) || input.amount <= 0) {
      throw new BadRequestException("Valor da transacao precisa ser maior que zero.");
    }

    if (!input.postedAt) {
      throw new BadRequestException("Data da transacao obrigatoria.");
    }
  }

  private mapDirectionFilter(direction?: string) {
    if (direction === "income") {
      return {
        in: ["INCOME", "REFUND"] satisfies TransactionType[]
      };
    }

    if (direction === "expense") {
      return {
        in: [
          "EXPENSE",
          "CREDIT_CARD_PAYMENT",
          "GOAL_CONTRIBUTION",
          "INVESTMENT",
          "LIABILITY_PAYMENT",
          "CREDIT_CARD_PURCHASE"
        ] satisfies TransactionType[]
      };
    }

    if (direction === "transfer") {
      return "TRANSFER" satisfies TransactionType;
    }

    return undefined;
  }
}
