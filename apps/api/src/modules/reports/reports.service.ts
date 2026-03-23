import { Injectable } from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import {
  addMonths,
  endOfMonth,
  isInflow,
  isOutflow,
  monthLabel,
  startOfMonth,
  toNumber
} from "../../common/finance.utils";
import { NetWorthSnapshotsService } from "../../common/net-worth-snapshots.service";
import { PrismaService } from "../../common/prisma.service";

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly netWorthSnapshots: NetWorthSnapshotsService
  ) {}

  async list(auth: AuthenticatedRequestContext) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const rangeStart = addMonths(monthStart, -5);

    const [transactions, liabilities, score, totals] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId: auth.userId,
          postedAt: {
            gte: rangeStart,
            lte: monthEnd
          },
          status: {
            not: "CANCELED"
          }
        },
        include: {
          category: true
        }
      }),
      this.prisma.liability.findMany({
        where: { userId: auth.userId, isArchived: false }
      }),
      this.prisma.scoreHistory.findFirst({
        where: { userId: auth.userId },
        orderBy: { snapshotDate: "desc" }
      }),
      this.netWorthSnapshots.calculateTotals(auth.userId)
    ]);

    const currentMonthTransactions = transactions.filter(
      (item) => item.postedAt >= monthStart && item.postedAt <= monthEnd
    );
    const income = currentMonthTransactions
      .filter((item) => item.status === "CLEARED" && isInflow(item.type))
      .reduce((sum, item) => sum + toNumber(item.amount), 0);
    const expenses = currentMonthTransactions
      .filter((item) => item.status === "CLEARED" && isOutflow(item.type))
      .reduce((sum, item) => sum + toNumber(item.amount), 0);

    const categorySpendMap = new Map<string, number>();
    currentMonthTransactions
      .filter((item) => item.status === "CLEARED" && isOutflow(item.type))
      .forEach((item) => {
        const label = item.category?.name ?? "Sem categoria";
        categorySpendMap.set(label, (categorySpendMap.get(label) ?? 0) + toNumber(item.amount));
      });

    const categorySpend = [...categorySpendMap.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([category, amount]) => ({
        category,
        amount,
        share: expenses > 0 ? Number(((amount / expenses) * 100).toFixed(1)) : 0
      }));

    const monthlyFlow = Array.from({ length: 6 }).map((_, index) => {
      const start = addMonths(monthStart, index - 5);
      const end = endOfMonth(start);
      const monthTransactions = transactions.filter(
        (item) => item.postedAt >= start && item.postedAt <= end
      );

      return {
        month: monthLabel(start),
        income: monthTransactions
          .filter((item) => item.status === "CLEARED" && isInflow(item.type))
          .reduce((sum, item) => sum + toNumber(item.amount), 0),
        expenses: monthTransactions
          .filter((item) => item.status === "CLEARED" && isOutflow(item.type))
          .reduce((sum, item) => sum + toNumber(item.amount), 0)
      };
    });

    return {
      cards: [
        {
          id: "saldo-mensal",
          title: "Saldo do mes",
          summary: "Receitas menos despesas compensadas no periodo atual.",
          metric: income - expenses
        },
        {
          id: "dividas",
          title: "Dividas em aberto",
          summary: "Passivos ativos registrados no seu patrimonio.",
          metric: liabilities.reduce((sum, item) => sum + toNumber(item.currentBalance), 0)
        },
        {
          id: "patrimonio",
          title: "Patrimonio liquido",
          summary: "Ativos menos passivos com base no cadastro atual.",
          metric: totals.netWorth
        }
      ],
      categorySpend,
      monthlyFlow,
      score: score
        ? {
            overall: score.overallScore,
            organization: score.organizationScore,
            predictability: score.predictabilityScore,
            discipline: score.disciplineScore,
            protection: score.protectionScore,
            growth: score.growthScore,
            debt: score.debtScore
          }
        : null
    };
  }
}
