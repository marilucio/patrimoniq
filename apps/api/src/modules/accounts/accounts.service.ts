import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AccountType, Prisma } from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { labelForEnum, signedAmount, toNumber } from "../../common/finance.utils";
import { PrismaService } from "../../common/prisma.service";
import { ProductAnalyticsService } from "../../common/product-analytics.service";

interface AccountInput {
  name: string;
  type: AccountType;
  institutionName?: string;
  openingBalance?: number;
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: ProductAnalyticsService
  ) {}

  async list(auth: AuthenticatedRequestContext) {
    const accounts = await this.prisma.account.findMany({
      where: {
        userId: auth.userId,
        isArchived: false
      },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    });

    return {
      items: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: labelForEnum(account.type),
        typeCode: account.type,
        institutionName: account.institutionName,
        openingBalance: toNumber(account.openingBalance),
        currentBalance: toNumber(account.currentBalance)
      }))
    };
  }

  async create(auth: AuthenticatedRequestContext, input: AccountInput) {
    this.validate(input);
    const openingBalance = new Prisma.Decimal(input.openingBalance ?? 0);
    const account = await this.prisma.account.create({
      data: {
        userId: auth.userId,
        name: input.name.trim(),
        type: input.type,
        institutionName: input.institutionName?.trim() || null,
        openingBalance,
        currentBalance: openingBalance
      }
    });

    const activeAccountsCount = await this.prisma.account.count({
      where: {
        userId: auth.userId,
        isArchived: false
      }
    });

    if (activeAccountsCount === 1) {
      await this.analytics.recordOnceForUser({
        userId: auth.userId,
        sessionId: auth.sessionId,
        name: "FIRST_ACCOUNT_CREATED",
        pagePath: "/settings",
        metadata: {
          accountType: account.type
        }
      });
    }

    return this.toPublicAccount(account);
  }

  async update(
    auth: AuthenticatedRequestContext,
    accountId: string,
    input: Partial<AccountInput>
  ) {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        userId: auth.userId,
        isArchived: false
      }
    });

    if (!account) {
      throw new NotFoundException("Conta nao encontrada.");
    }

    await this.prisma.account.update({
      where: { id: account.id },
      data: {
        name: input.name?.trim() || account.name,
        type: input.type ?? account.type,
        institutionName:
          input.institutionName !== undefined
            ? input.institutionName.trim() || null
            : account.institutionName,
        openingBalance:
          input.openingBalance !== undefined
            ? new Prisma.Decimal(input.openingBalance)
            : account.openingBalance
      }
    });

    await this.recalculateBalance(account.id);
    return this.findPublicAccount(auth.userId, account.id);
  }

  async archive(auth: AuthenticatedRequestContext, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        userId: auth.userId,
        isArchived: false
      }
    });

    if (!account) {
      throw new NotFoundException("Conta nao encontrada.");
    }

    await this.prisma.account.update({
      where: { id: account.id },
      data: {
        isArchived: true
      }
    });

    return {
      success: true
    };
  }

  async recalculateBalance(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return;
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId: account.userId,
        OR: [
          {
            accountId,
            status: "CLEARED"
          },
          {
            counterpartyAccountId: accountId,
            status: "CLEARED",
            type: "TRANSFER"
          }
        ]
      }
    });

    const total = transactions.reduce((sum, transaction) => {
      if (transaction.type === "TRANSFER" && transaction.counterpartyAccountId === accountId) {
        return sum + toNumber(transaction.amount);
      }

      return sum + signedAmount(transaction.type, transaction.amount);
    }, toNumber(account.openingBalance));

    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        currentBalance: total
      }
    });
  }

  private async findPublicAccount(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        userId
      }
    });

    if (!account) {
      throw new NotFoundException("Conta nao encontrada.");
    }

    return this.toPublicAccount(account);
  }

  private toPublicAccount(account: {
    id: string;
    name: string;
    type: AccountType;
    institutionName: string | null;
    openingBalance: Prisma.Decimal;
    currentBalance: Prisma.Decimal;
  }) {
    return {
      id: account.id,
      name: account.name,
      type: labelForEnum(account.type),
      typeCode: account.type,
      institutionName: account.institutionName,
      openingBalance: toNumber(account.openingBalance),
      currentBalance: toNumber(account.currentBalance)
    };
  }

  private validate(input: AccountInput) {
    if (!input.name?.trim()) {
      throw new BadRequestException("Nome da conta obrigatorio.");
    }
  }
}
