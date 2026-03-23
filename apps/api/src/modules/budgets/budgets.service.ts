import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { BudgetCadence, Prisma } from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { isOutflow, labelForEnum, toNumber } from "../../common/finance.utils";
import { OwnershipService } from "../../common/ownership.service";
import { PrismaService } from "../../common/prisma.service";

interface BudgetInput {
  categoryId?: string;
  subcategoryId?: string;
  name: string;
  cadence?: BudgetCadence;
  periodStart: string;
  periodEnd: string;
  amountLimit: number;
  alertThresholdPercent?: number;
  notes?: string;
}

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService
  ) {}

  async list(auth: AuthenticatedRequestContext) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId: auth.userId, isArchived: false },
      include: {
        category: true,
        subcategory: true
      },
      orderBy: [{ periodStart: "desc" }, { name: "asc" }]
    });

    const items = await Promise.all(
      budgets.map(async (budget) => {
        const transactions = await this.prisma.transaction.findMany({
          where: {
            userId: auth.userId,
            postedAt: {
              gte: budget.periodStart,
              lte: budget.periodEnd
            },
            categoryId: budget.categoryId ?? undefined,
            subcategoryId: budget.subcategoryId ?? undefined,
            status: {
              not: "CANCELED"
            }
          }
        });

        const actual = transactions
          .filter((transaction) => transaction.status === "CLEARED" && isOutflow(transaction.type))
          .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
        const forecast = transactions
          .filter((transaction) => isOutflow(transaction.type))
          .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);

        return {
          id: budget.id,
          name: budget.name,
          category: budget.subcategory?.name ?? budget.category?.name ?? budget.name,
          planned: toNumber(budget.amountLimit),
          actual,
          forecast,
          cadence: labelForEnum(budget.cadence),
          cadenceCode: budget.cadence,
          alertThresholdPercent: budget.alertThresholdPercent,
          notes: budget.notes ?? "",
          periodStart: budget.periodStart.toISOString().slice(0, 10),
          periodEnd: budget.periodEnd.toISOString().slice(0, 10),
          categoryId: budget.categoryId,
          subcategoryId: budget.subcategoryId
        };
      })
    );

    return {
      items,
      atRisk: items.filter((item) => item.forecast > item.planned),
      totals: {
        planned: items.reduce((sum, item) => sum + item.planned, 0),
        actual: items.reduce((sum, item) => sum + item.actual, 0),
        forecast: items.reduce((sum, item) => sum + item.forecast, 0)
      }
    };
  }

  async create(auth: AuthenticatedRequestContext, input: BudgetInput) {
    this.validate(input);
    const refs = await this.ownership.resolveCategoryAndSubcategory(auth.userId, {
      categoryId: input.categoryId ?? null,
      subcategoryId: input.subcategoryId ?? null
    });

    return this.prisma.budget.create({
      data: {
        userId: auth.userId,
        categoryId: refs.categoryId,
        subcategoryId: refs.subcategoryId,
        name: input.name.trim(),
        cadence: input.cadence ?? "MONTHLY",
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        amountLimit: new Prisma.Decimal(input.amountLimit),
        alertThresholdPercent: input.alertThresholdPercent ?? 85,
        notes: input.notes ?? null
      }
    });
  }

  async update(
    auth: AuthenticatedRequestContext,
    budgetId: string,
    input: Partial<BudgetInput>
  ) {
    const budget = await this.prisma.budget.findFirst({
      where: {
        id: budgetId,
        userId: auth.userId,
        isArchived: false
      }
    });

    if (!budget) {
      throw new NotFoundException("Orcamento nao encontrado.");
    }

    const refs = await this.ownership.resolveCategoryAndSubcategory(auth.userId, {
      categoryId: input.categoryId !== undefined ? input.categoryId || null : budget.categoryId,
      subcategoryId:
        input.subcategoryId !== undefined ? input.subcategoryId || null : budget.subcategoryId
    });

    return this.prisma.budget.update({
      where: { id: budget.id },
      data: {
        categoryId: refs.categoryId,
        subcategoryId: refs.subcategoryId,
        name: input.name?.trim() || budget.name,
        cadence: input.cadence ?? budget.cadence,
        periodStart: input.periodStart ? new Date(input.periodStart) : budget.periodStart,
        periodEnd: input.periodEnd ? new Date(input.periodEnd) : budget.periodEnd,
        amountLimit:
          input.amountLimit !== undefined
            ? new Prisma.Decimal(input.amountLimit)
            : budget.amountLimit,
        alertThresholdPercent:
          input.alertThresholdPercent ?? budget.alertThresholdPercent,
        notes: input.notes !== undefined ? input.notes || null : budget.notes
      }
    });
  }

  async archive(auth: AuthenticatedRequestContext, budgetId: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, userId: auth.userId, isArchived: false }
    });

    if (!budget) {
      throw new NotFoundException("Orcamento nao encontrado.");
    }

    await this.prisma.budget.update({
      where: { id: budget.id },
      data: {
        isArchived: true
      }
    });

    return { success: true };
  }

  private validate(input: BudgetInput) {
    if (!input.name?.trim()) {
      throw new BadRequestException("Nome do orcamento obrigatorio.");
    }

    if (!input.periodStart || !input.periodEnd) {
      throw new BadRequestException("Periodo do orcamento obrigatorio.");
    }

    if (input.amountLimit === undefined || Number.isNaN(input.amountLimit) || input.amountLimit <= 0) {
      throw new BadRequestException("Limite do orcamento precisa ser maior que zero.");
    }
  }
}
