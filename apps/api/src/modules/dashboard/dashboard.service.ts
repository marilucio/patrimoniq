import { Injectable } from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import {
  endOfMonth,
  isInflow,
  isOutflow,
  monthLabel,
  startOfMonth,
  toNumber
} from "../../common/finance.utils";
import { NetWorthSnapshotsService } from "../../common/net-worth-snapshots.service";
import { PrismaService } from "../../common/prisma.service";
import { ProductAnalyticsService } from "../../common/product-analytics.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly netWorthSnapshots: NetWorthSnapshotsService,
    private readonly analytics: ProductAnalyticsService
  ) {}

  async getOverview(auth: AuthenticatedRequestContext) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [user, transactions, goals, totals, budgets, accountsCount, categoriesCount, totalGoalsCount] =
      await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: {
            id: auth.userId
          }
        }),
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
          },
          orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }]
        }),
        this.prisma.goal.findMany({
          where: {
            userId: auth.userId,
            status: {
              in: ["ACTIVE", "PAUSED"]
            }
          },
          orderBy: [{ priority: "asc" }, { targetDate: "asc" }],
          take: 4
        }),
        this.netWorthSnapshots.calculateTotals(auth.userId),
        this.prisma.budget.findMany({
          where: {
            userId: auth.userId,
            isArchived: false,
            periodStart: {
              lte: monthEnd
            },
            periodEnd: {
              gte: monthStart
            }
          }
        }),
        this.prisma.account.count({
          where: {
            userId: auth.userId,
            isArchived: false
          }
        }),
        this.prisma.category.count({
          where: {
            userId: auth.userId,
            isActive: true
          }
        }),
        this.prisma.goal.count({
          where: {
            userId: auth.userId
          }
        })
      ]);

    const currentMonthTransactions = transactions.filter(
      (transaction) => transaction.postedAt >= monthStart && transaction.postedAt <= monthEnd
    );

    const income = currentMonthTransactions
      .filter((transaction) => transaction.status === "CLEARED" && isInflow(transaction.type))
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const expenses = currentMonthTransactions
      .filter((transaction) => transaction.status === "CLEARED" && isOutflow(transaction.type))
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const upcomingBills = currentMonthTransactions
      .filter(
        (transaction) =>
          isOutflow(transaction.type) &&
          transaction.status !== "CLEARED" &&
          transaction.dueDate &&
          transaction.dueDate >= now
      )
      .sort((left, right) => (left.dueDate?.getTime() ?? 0) - (right.dueDate?.getTime() ?? 0))
      .slice(0, 5);
    const upcomingBillsAmount = upcomingBills.reduce(
      (sum, transaction) => sum + toNumber(transaction.amount),
      0
    );
    const monthBalance = income - expenses;
    const leftover = monthBalance - upcomingBillsAmount;

    const categoryTotals = new Map<string, number>();
    currentMonthTransactions
      .filter((transaction) => transaction.status === "CLEARED" && isOutflow(transaction.type))
      .forEach((transaction) => {
        const key = transaction.category?.name ?? "Sem categoria";
        categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + toNumber(transaction.amount));
      });

    const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    const totalBudget = budgets.reduce((sum, budget) => sum + toNumber(budget.amountLimit), 0);
    const currentBudgetUsage = totalBudget > 0 ? expenses / totalBudget : 0;
    const firstName = auth.fullName.split(" ")[0] ?? auth.fullName;
    const incomeTransactionsCount = transactions.filter(
      (transaction) => transaction.status !== "CANCELED" && isInflow(transaction.type)
    ).length;
    const expenseTransactionsCount = transactions.filter(
      (transaction) => transaction.status !== "CANCELED" && isOutflow(transaction.type)
    ).length;
    const onboardingSteps = [
      {
        id: "first-account",
        title: "Cadastre uma conta",
        description: "Ex.: conta corrente, poupanca ou carteira. O saldo comeca aqui.",
        done: accountsCount > 0,
        href: "/settings",
        cta: "Criar conta"
      },
      {
        id: "review-categories",
        title: "Confira suas categorias",
        description: "Ajuste os nomes para refletir como voce realmente gasta.",
        done: categoriesCount > 0,
        href: "/settings",
        cta: "Ver categorias"
      },
      {
        id: "first-income",
        title: "Lance uma receita",
        description: "Registre o que entrou neste mes. O painel calcula a sobra automaticamente.",
        done: incomeTransactionsCount > 0,
        href: "/transactions",
        cta: "Lancar receita"
      },
      {
        id: "first-expense",
        title: "Lance uma despesa",
        description: "Registre uma saida para ativar alertas e relatorios.",
        done: expenseTransactionsCount > 0,
        href: "/transactions",
        cta: "Lancar despesa"
      },
      {
        id: "first-goal",
        title: "Crie uma meta",
        description: "Defina um objetivo financeiro e acompanhe o progresso aqui.",
        done: totalGoalsCount > 0,
        href: "/goals",
        cta: "Criar meta"
      }
    ];
    const completedOnboardingSteps = onboardingSteps.filter((step) => step.done).length;
    const remainingSteps = onboardingSteps.filter((step) => !step.done).map((step) => step.id);
    const nextStep = onboardingSteps.find((step) => !step.done) ?? null;
    const accountAgeHours = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60);

    await this.analytics.recordOnceForUser({
      userId: auth.userId,
      sessionId: auth.sessionId,
      name: "DASHBOARD_FIRST_VIEWED",
      pagePath: "/dashboard",
      metadata: {
        referenceMonth: monthLabel(now)
      }
    });

    if (remainingSteps.length === 0) {
      await this.analytics.recordOnceForUser({
        userId: auth.userId,
        sessionId: auth.sessionId,
        name: "ONBOARDING_COMPLETED",
        pagePath: "/dashboard",
        metadata: {
          accountAgeHours: Math.round(accountAgeHours)
        }
      });
    }

    if (
      remainingSteps.length > 0 &&
      accountAgeHours >= this.analytics.onboardingStaleHours()
    ) {
      await this.analytics.recordOnceForUser({
        userId: auth.userId,
        sessionId: auth.sessionId,
        name: "ONBOARDING_STALLED",
        pagePath: "/dashboard",
        metadata: {
          remainingSteps,
          accountAgeHours: Math.round(accountAgeHours)
        }
      });
    }

    return {
      userName: firstName,
      referenceMonth: monthLabel(now),
      summary: {
        balanceMonth: monthBalance,
        income,
        expenses,
        leftover,
        upcomingBillsAmount,
        netWorth: totals.netWorth
      },
      upcomingBills: upcomingBills.map((transaction) => ({
        id: transaction.id,
        description: transaction.description,
        dueDate: transaction.dueDate?.toISOString().slice(0, 10) ?? transaction.postedAt.toISOString().slice(0, 10),
        amount: toNumber(transaction.amount)
      })),
      goals: goals.map((goal) => ({
        id: goal.id,
        name: goal.name,
        currentAmount: toNumber(goal.currentAmount),
        targetAmount: toNumber(goal.targetAmount),
        targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null
      })),
      onboarding: {
        completedSteps: completedOnboardingSteps,
        totalSteps: onboardingSteps.length,
        isComplete: completedOnboardingSteps === onboardingSteps.length,
        steps: onboardingSteps,
        nextStep,
        dashboardGuide: [
          "Saldo do mes mostra receitas menos despesas realizadas.",
          "Contas a vencer lista os compromissos ainda nao pagos.",
          "Metas e patrimonio mostram seu progresso financeiro."
        ],
        nudge:
          nextStep
            ? `Proximo passo: ${nextStep.title.toLowerCase()}.`
            : "Configuracao concluida. O painel agora reflete seus dados."
      },
      insights: this.buildInsights({
        income,
        expenses,
        leftover,
        upcomingBillsAmount,
        topCategory,
        totalBudget,
        currentBudgetUsage
      })
    };
  }

  private buildInsights(input: {
    income: number;
    expenses: number;
    leftover: number;
    upcomingBillsAmount: number;
    topCategory?: [string, number];
    totalBudget: number;
    currentBudgetUsage: number;
  }) {
    const insights = [];

    if (input.topCategory) {
      insights.push({
        id: "top-category",
        title: `${input.topCategory[0]} lidera seus gastos`,
        description: `Essa categoria concentrou R$ ${Math.round(input.topCategory[1])} no mes atual.`
      });
    }

    if (input.upcomingBillsAmount > 0) {
      insights.push({
        id: "upcoming-bills",
        title: "Ainda ha contas a vencer neste mes",
        description: `Voce ainda precisa cobrir R$ ${Math.round(input.upcomingBillsAmount)} ate o fechamento.`
      });
    }

    insights.push({
      id: "leftover",
      title:
        input.leftover >= 0
          ? "Sua sobra projetada segue positiva"
          : "Sua sobra projetada esta negativa",
      description:
        input.leftover >= 0
          ? `Mantendo o ritmo atual, sobram R$ ${Math.round(input.leftover)}.`
          : `Mantendo o ritmo atual, faltam R$ ${Math.round(Math.abs(input.leftover))}.`
    });

    if (input.totalBudget > 0) {
      insights.push({
        id: "budget-usage",
        title:
          input.currentBudgetUsage > 0.85
            ? "Seu orcamento do mes esta apertado"
            : "Seu orcamento ainda esta sob controle",
        description: `Voce consumiu ${Math.round(input.currentBudgetUsage * 100)}% do limite planejado.`
      });
    }

    return insights.slice(0, 4);
  }
}
