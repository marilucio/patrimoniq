import { Injectable } from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { EngagementAnalyticsService } from "../../common/engagement-analytics.service";
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
    private readonly analytics: ProductAnalyticsService,
    private readonly engagementAnalytics: EngagementAnalyticsService
  ) {}

  async registerActionPlanInteraction(
    auth: AuthenticatedRequestContext,
    actionId: string,
    input?: { kind?: "open" | "done" | "dismiss"; route?: string }
  ) {
    const kind = input?.kind ?? "done";
    await this.engagementAnalytics.record({
      userId: auth.userId,
      sessionId: auth.sessionId,
      source: "dashboard_action_plan",
      eventName: `action_${kind}`,
      metadata: {
        actionId,
        route: input?.route ?? null
      }
    });
    return { success: true };
  }

  async getOverview(auth: AuthenticatedRequestContext) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [user, transactions, goals, totals, budgets, accountsCount, categoriesCount, totalGoalsCount, activeAlerts] =
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
        }),
        this.prisma.alert.findMany({
          where: {
            userId: auth.userId,
            dismissedAt: null
          },
          orderBy: [{ severity: "desc" }, { triggerDate: "desc" }],
          take: 20
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
    const advisor = this.buildAdvisor({
      now,
      leftover,
      currentBudgetUsage,
      goals,
      alerts: activeAlerts
    });
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

    await this.engagementAnalytics.record({
      userId: auth.userId,
      sessionId: auth.sessionId,
      source: "dashboard_advisor",
      eventName: "advisor_viewed",
      metadata: {
        priorityKey: advisor.priorityOfWeek.id,
        riskLevel: advisor.riskSummary.level,
        actionsCount: advisor.shortTermActions.length
      }
    });

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
      }),
      advisor
    };
  }

  private buildAdvisor(input: {
    now: Date;
    leftover: number;
    currentBudgetUsage: number;
    goals: Array<{
      id: string;
      name: string;
      targetAmount: { toString(): string } | number | string;
      currentAmount: { toString(): string } | number | string;
    }>;
    alerts: Array<{
      id: string;
      type: string;
      severity: string;
      title: string;
      actionRoute: string | null;
      actionLabel: string | null;
      metadata: unknown;
    }>;
  }) {
    const actionable = input.alerts
      .map((alert) => {
        const metadata =
          alert.metadata && typeof alert.metadata === "object"
            ? (alert.metadata as Record<string, unknown>)
            : {};
        const recommendation =
          metadata.recommendation && typeof metadata.recommendation === "object"
            ? (metadata.recommendation as Record<string, unknown>)
            : {};
        const reviewAt =
          typeof recommendation.reviewAt === "string"
            ? recommendation.reviewAt
            : null;
        const dueDate =
          typeof metadata.dueDate === "string"
            ? metadata.dueDate
            : reviewAt;
        const amountCandidates = [
          metadata.amountRounded,
          metadata.spentRounded,
          metadata.remaining,
          metadata.projectedBalance,
          metadata.currentExpenses
        ]
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .map((value) => Math.abs(value));
        const impactAmount = amountCandidates.length > 0 ? Math.max(...amountCandidates) : 0;
        const severityScore =
          alert.severity === "CRITICAL" ? 100 : alert.severity === "WARNING" ? 70 : 45;
        const urgencyScore = dueDate ? this.urgencyScore(input.now, dueDate) : 10;
        const impactScore =
          impactAmount >= 3000
            ? 40
            : impactAmount >= 1500
              ? 30
              : impactAmount >= 600
                ? 20
                : impactAmount > 0
                  ? 10
                  : 5;
        const typeScore =
          alert.type === "CASHFLOW"
            ? 20
            : alert.type === "BUDGET"
              ? 15
              : alert.type === "GOAL"
                ? 12
                : 8;
        const score = severityScore + urgencyScore + impactScore + typeScore;
        const reason =
          typeof recommendation.whyItMatters === "string"
            ? recommendation.whyItMatters
            : alert.title;
        const title =
          typeof recommendation.whatToDoNow === "string"
            ? recommendation.whatToDoNow
            : alert.title;
        const impactEstimate =
          typeof recommendation.impactEstimate === "string"
            ? recommendation.impactEstimate
            : impactAmount > 0
              ? `Impacto potencial aproximado: R$ ${Math.round(impactAmount)}.`
              : "Ajuste preventivo para manter previsibilidade.";

        return {
          id: `alert:${alert.id}`,
          title,
          reason,
          route: alert.actionRoute ?? "/dashboard",
          cta: alert.actionLabel ?? "Ver detalhe",
          dueDate,
          score,
          impactEstimate
        };
      })
      .sort((a, b) => b.score - a.score);

    const shortTermActions = actionable.slice(0, 3);
    const topAction = shortTermActions[0] ?? {
      id: "monthly-review",
      title: "Fazer revisao financeira da semana",
      reason: "Revisao frequente melhora previsibilidade e reduz surpresas.",
      route: "/reports",
      cta: "Abrir relatorios",
      dueDate: input.now.toISOString().slice(0, 10),
      score: 70,
      impactEstimate: "Objetivo: manter consistencia e evitar desvios."
    };
    const criticalCount = actionable.filter((item) => item.score >= 145).length;
    const warningCount = actionable.filter(
      (item) => item.score >= 110 && item.score < 145
    ).length;
    const riskScore = Math.min(
      100,
      Math.max(
        15,
        Math.round(
          (criticalCount * 28) +
          (warningCount * 12) +
          (input.leftover < 0 ? 18 : 0) +
          (input.currentBudgetUsage > 1 ? 16 : input.currentBudgetUsage > 0.85 ? 8 : 0)
        )
      )
    );
    const riskLevel =
      riskScore >= 80
        ? "critico"
        : riskScore >= 60
          ? "alto"
          : riskScore >= 35
            ? "moderado"
            : "baixo";
    const staleGoals = input.goals.filter((goal) => {
      const target = Number(String(goal.targetAmount));
      const current = Number(String(goal.currentAmount));
      return target > current;
    });

    return {
      priorityOfWeek: {
        id: topAction.id,
        title: topAction.title,
        route: topAction.route,
        cta: topAction.cta,
        dueDate: topAction.dueDate,
        score: topAction.score
      },
      mainAttention:
        topAction.reason,
      shortTermActions,
      riskSummary: {
        level: riskLevel,
        score: riskScore,
        label:
          riskLevel === "critico"
            ? "Risco alto e imediato"
            : riskLevel === "alto"
              ? "Risco elevado"
              : riskLevel === "moderado"
                ? "Risco moderado"
                : "Risco controlado",
        description:
          criticalCount > 0
            ? `${criticalCount} ponto(s) critico(s) pedem acao imediata.`
            : warningCount > 0
              ? `${warningCount} ponto(s) relevante(s) para ajustar nesta semana.`
              : "Sem sinais urgentes no momento."
      },
      monthlyActionPlan: {
        title: "Plano de acao do mes",
        subtitle: "As 3 acoes mais relevantes para manter sua saude financeira.",
        actions: shortTermActions
      },
      routine: {
        weeklyPriority: topAction.title,
        monthReview:
          input.leftover < 0
            ? "Revise despesas variaveis e ajuste compromissos dos proximos 7 dias."
            : "Mantenha o controle semanal para preservar a sobra do mes.",
        goalConsistency:
          staleGoals.length > 0
            ? `${staleGoals.length} meta(s) ainda sem ritmo ideal de aporte.`
            : "Metas em consistencia adequada neste periodo.",
        followUpReminder:
          "Reserve 10 minutos na semana para revisar alertas, metas e proxima fatura."
      }
    };
  }

  private urgencyScore(now: Date, referenceDateIso: string) {
    const target = new Date(referenceDateIso);
    if (Number.isNaN(target.getTime())) return 10;
    const diffDays = Math.floor((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays <= 0) return 35;
    if (diffDays <= 2) return 28;
    if (diffDays <= 7) return 18;
    return 10;
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
