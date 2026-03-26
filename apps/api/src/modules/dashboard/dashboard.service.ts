import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { EngagementAnalyticsService } from "../../common/engagement-analytics.service";
import {
  endOfMonth,
  isInflow,
  isOutflow,
  monthLabel,
  startOfMonth,
  toNumber,
} from "../../common/finance.utils";
import { NetWorthSnapshotsService } from "../../common/net-worth-snapshots.service";
import { PrismaService } from "../../common/prisma.service";
import { ProductAnalyticsService } from "../../common/product-analytics.service";

type ActionStatus =
  | "SUGGESTED"
  | "VIEWED"
  | "COMPLETED"
  | "POSTPONED"
  | "DISMISSED"
  | "EXPIRED";

interface AdvisoryActionRecord {
  id: string;
  userId: string;
  source: string;
  sourceRef: string;
  type: string;
  title: string;
  message: string;
  recommendation: string;
  priority: number;
  status: ActionStatus;
  suggestionTone: string;
  dueDate: Date | null;
  postponedUntil: Date | null;
  viewedAt: Date | null;
  resolvedAt: Date | null;
  feedback: string | null;
  impactSummary: string | null;
  impactScore: number | null;
  financialContext: unknown;
  createdAt: Date;
  updatedAt: Date;
}

interface AdvisoryActionEventRecord {
  id: string;
  userId: string;
  advisoryActionId: string;
  fromStatus: ActionStatus | null;
  toStatus: ActionStatus;
  note: string | null;
  metadata: unknown;
  occurredAt: Date;
}

interface AdvisorActionDraft {
  id: string;
  source: string;
  type: string;
  title: string;
  message: string;
  recommendation: string;
  route: string;
  cta: string;
  dueDate: string | null;
  score: number;
  impactEstimate: string;
  context: Record<string, unknown>;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly netWorthSnapshots: NetWorthSnapshotsService,
    private readonly analytics: ProductAnalyticsService,
    private readonly engagementAnalytics: EngagementAnalyticsService,
  ) {}

  private advisoryActionStore() {
    return (
      this.prisma as unknown as {
        advisoryAction: {
          findMany: (
            args: Record<string, unknown>,
          ) => Promise<AdvisoryActionRecord[]>;
          findFirst: (
            args: Record<string, unknown>,
          ) => Promise<AdvisoryActionRecord | null>;
          create: (
            args: Record<string, unknown>,
          ) => Promise<AdvisoryActionRecord>;
          update: (
            args: Record<string, unknown>,
          ) => Promise<AdvisoryActionRecord>;
          updateMany: (
            args: Record<string, unknown>,
          ) => Promise<{ count: number }>;
        };
      }
    ).advisoryAction;
  }

  private advisoryActionEventStore() {
    return (
      this.prisma as unknown as {
        advisoryActionEvent: {
          findMany: (
            args: Record<string, unknown>,
          ) => Promise<AdvisoryActionEventRecord[]>;
          create: (
            args: Record<string, unknown>,
          ) => Promise<AdvisoryActionEventRecord>;
        };
      }
    ).advisoryActionEvent;
  }

  async registerActionPlanInteraction(
    auth: AuthenticatedRequestContext,
    actionId: string,
    input?: {
      kind?: "open" | "done" | "dismiss" | "postpone";
      route?: string;
      feedback?: string;
    },
  ) {
    const kind = input?.kind ?? "done";
    if (kind === "open") {
      await this.setAdvisoryActionStatus(auth, actionId, "VIEWED", {
        metadata: { route: input?.route ?? null },
      });
    }
    if (kind === "done") {
      await this.setAdvisoryActionStatus(auth, actionId, "COMPLETED", {
        note: input?.feedback,
        metadata: { route: input?.route ?? null },
      });
    }
    if (kind === "dismiss") {
      await this.setAdvisoryActionStatus(auth, actionId, "DISMISSED", {
        metadata: { route: input?.route ?? null },
      });
    }
    if (kind === "postpone") {
      const postponeTo = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await this.setAdvisoryActionStatus(auth, actionId, "POSTPONED", {
        metadata: {
          route: input?.route ?? null,
          postponedUntil: postponeTo.toISOString(),
        },
      });
    }
    await this.engagementAnalytics.record({
      userId: auth.userId,
      sessionId: auth.sessionId,
      source: "dashboard_action_plan",
      eventName: `action_${kind}`,
      metadata: {
        actionId,
        route: input?.route ?? null,
      },
    });
    return { success: true };
  }

  async updateActionPlanStatus(
    auth: AuthenticatedRequestContext,
    actionId: string,
    input?: {
      status?: "completed" | "postponed" | "dismissed";
      feedback?: string;
      postponeDays?: number;
    },
  ) {
    const status = input?.status ?? "completed";
    if (status === "completed") {
      const updated = await this.setAdvisoryActionStatus(
        auth,
        actionId,
        "COMPLETED",
        {
          note: input?.feedback,
        },
      );
      return { success: true, status: updated.status };
    }
    if (status === "dismissed") {
      const updated = await this.setAdvisoryActionStatus(
        auth,
        actionId,
        "DISMISSED",
      );
      return { success: true, status: updated.status };
    }
    const postponeDays = Number(input?.postponeDays ?? 3);
    const safeDays = Number.isFinite(postponeDays)
      ? Math.min(Math.max(postponeDays, 1), 15)
      : 3;
    const postponedUntil = new Date(
      Date.now() + safeDays * 24 * 60 * 60 * 1000,
    );
    const updated = await this.setAdvisoryActionStatus(
      auth,
      actionId,
      "POSTPONED",
      {
        metadata: { postponedUntil: postponedUntil.toISOString() },
      },
    );
    return {
      success: true,
      status: updated.status,
      postponedUntil: updated.postponedUntil,
    };
  }

  async getOverview(auth: AuthenticatedRequestContext) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      user,
      transactions,
      goals,
      totals,
      budgets,
      accountsCount,
      categoriesCount,
      totalGoalsCount,
      activeAlerts,
    ] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: {
          id: auth.userId,
        },
      }),
      this.prisma.transaction.findMany({
        where: {
          userId: auth.userId,
          postedAt: {
            gte: rangeStart,
            lte: monthEnd,
          },
          status: {
            not: "CANCELED",
          },
        },
        include: {
          category: true,
        },
        orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.goal.findMany({
        where: {
          userId: auth.userId,
          status: {
            in: ["ACTIVE", "PAUSED"],
          },
        },
        orderBy: [{ priority: "asc" }, { targetDate: "asc" }],
        take: 4,
      }),
      this.netWorthSnapshots.calculateTotals(auth.userId),
      this.prisma.budget.findMany({
        where: {
          userId: auth.userId,
          isArchived: false,
          periodStart: {
            lte: monthEnd,
          },
          periodEnd: {
            gte: monthStart,
          },
        },
      }),
      this.prisma.account.count({
        where: {
          userId: auth.userId,
          isArchived: false,
        },
      }),
      this.prisma.category.count({
        where: {
          userId: auth.userId,
          isActive: true,
        },
      }),
      this.prisma.goal.count({
        where: {
          userId: auth.userId,
        },
      }),
      this.prisma.alert.findMany({
        where: {
          userId: auth.userId,
          dismissedAt: null,
        },
        orderBy: [{ severity: "desc" }, { triggerDate: "desc" }],
        take: 20,
      }),
    ]);

    const currentMonthTransactions = transactions.filter(
      (transaction) =>
        transaction.postedAt >= monthStart && transaction.postedAt <= monthEnd,
    );

    const income = currentMonthTransactions
      .filter(
        (transaction) =>
          transaction.status === "CLEARED" && isInflow(transaction.type),
      )
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const expenses = currentMonthTransactions
      .filter(
        (transaction) =>
          transaction.status === "CLEARED" && isOutflow(transaction.type),
      )
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const upcomingBills = currentMonthTransactions
      .filter(
        (transaction) =>
          isOutflow(transaction.type) &&
          transaction.status !== "CLEARED" &&
          transaction.dueDate &&
          transaction.dueDate >= now,
      )
      .sort(
        (left, right) =>
          (left.dueDate?.getTime() ?? 0) - (right.dueDate?.getTime() ?? 0),
      )
      .slice(0, 5);
    const upcomingBillsAmount = upcomingBills.reduce(
      (sum, transaction) => sum + toNumber(transaction.amount),
      0,
    );
    const monthBalance = income - expenses;
    const leftover = monthBalance - upcomingBillsAmount;

    const categoryTotals = new Map<string, number>();
    currentMonthTransactions
      .filter(
        (transaction) =>
          transaction.status === "CLEARED" && isOutflow(transaction.type),
      )
      .forEach((transaction) => {
        const key = transaction.category?.name ?? "Sem categoria";
        categoryTotals.set(
          key,
          (categoryTotals.get(key) ?? 0) + toNumber(transaction.amount),
        );
      });

    const topCategory = [...categoryTotals.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    const totalBudget = budgets.reduce(
      (sum, budget) => sum + toNumber(budget.amountLimit),
      0,
    );
    const currentBudgetUsage = totalBudget > 0 ? expenses / totalBudget : 0;
    const advisorDraft = this.buildAdvisor({
      now,
      leftover,
      currentBudgetUsage,
      goals,
      alerts: activeAlerts,
    });
    await this.expireOverdueActions(auth.userId, now);
    await this.syncAdvisoryActions(
      auth.userId,
      advisorDraft.shortTermActions,
      now,
    );
    const [behaviorProfile, actionPlan, consultiveAnalytics] =
      await Promise.all([
        this.buildBehaviorProfile(auth.userId),
        this.loadActionPlan(auth.userId, now),
        this.buildConsultiveAnalytics(auth.userId, now),
      ]);
    const adaptedActionPlan = this.applyBehaviorAdaptation(
      actionPlan,
      behaviorProfile,
      now,
    );
    const topAction = adaptedActionPlan[0] ??
      advisorDraft.shortTermActions[0] ?? {
        id: "fallback-review",
        source: "plano",
        type: "BEHAVIOR",
        title: advisorDraft.priorityOfWeek.title,
        message: advisorDraft.mainAttention,
        recommendation: advisorDraft.priorityOfWeek.title,
        route: advisorDraft.priorityOfWeek.route,
        cta: advisorDraft.priorityOfWeek.cta,
        dueDate: advisorDraft.priorityOfWeek.dueDate,
        score: advisorDraft.priorityOfWeek.score,
        impactEstimate: "Acompanhamento consultivo em atualizacao.",
        context: { suggestionTone: "objetivo" },
      };
    const advisor = {
      ...advisorDraft,
      priorityOfWeek: {
        id: topAction.id,
        title: topAction.title,
        route: topAction.route,
        cta: topAction.cta,
        dueDate: topAction.dueDate,
        score: topAction.score,
      },
      mainAttention: topAction.message,
      shortTermActions: adaptedActionPlan,
      monthlyActionPlan: {
        ...advisorDraft.monthlyActionPlan,
        actions: adaptedActionPlan,
      },
      routine: {
        ...advisorDraft.routine,
        weeklyPriority: topAction.title,
      },
      behaviorProfile,
      consultiveAnalytics,
    };
    const firstName = auth.fullName.split(" ")[0] ?? auth.fullName;
    const incomeTransactionsCount = transactions.filter(
      (transaction) =>
        transaction.status !== "CANCELED" && isInflow(transaction.type),
    ).length;
    const expenseTransactionsCount = transactions.filter(
      (transaction) =>
        transaction.status !== "CANCELED" && isOutflow(transaction.type),
    ).length;
    const onboardingSteps = [
      {
        id: "first-account",
        title: "Cadastre uma conta",
        description:
          "Ex.: conta corrente, poupanca ou carteira. O saldo comeca aqui.",
        done: accountsCount > 0,
        href: "/settings",
        cta: "Criar conta",
      },
      {
        id: "review-categories",
        title: "Confira suas categorias",
        description: "Ajuste os nomes para refletir como voce realmente gasta.",
        done: categoriesCount > 0,
        href: "/settings",
        cta: "Ver categorias",
      },
      {
        id: "first-income",
        title: "Lance uma receita",
        description:
          "Registre o que entrou neste mes. O painel calcula a sobra automaticamente.",
        done: incomeTransactionsCount > 0,
        href: "/transactions",
        cta: "Lancar receita",
      },
      {
        id: "first-expense",
        title: "Lance uma despesa",
        description: "Registre uma saida para ativar alertas e relatorios.",
        done: expenseTransactionsCount > 0,
        href: "/transactions",
        cta: "Lancar despesa",
      },
      {
        id: "first-goal",
        title: "Crie uma meta",
        description:
          "Defina um objetivo financeiro e acompanhe o progresso aqui.",
        done: totalGoalsCount > 0,
        href: "/goals",
        cta: "Criar meta",
      },
    ];
    const completedOnboardingSteps = onboardingSteps.filter(
      (step) => step.done,
    ).length;
    const remainingSteps = onboardingSteps
      .filter((step) => !step.done)
      .map((step) => step.id);
    const nextStep = onboardingSteps.find((step) => !step.done) ?? null;
    const accountAgeHours =
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60);

    await this.analytics.recordOnceForUser({
      userId: auth.userId,
      sessionId: auth.sessionId,
      name: "DASHBOARD_FIRST_VIEWED",
      pagePath: "/dashboard",
      metadata: {
        referenceMonth: monthLabel(now),
      },
    });

    if (remainingSteps.length === 0) {
      await this.analytics.recordOnceForUser({
        userId: auth.userId,
        sessionId: auth.sessionId,
        name: "ONBOARDING_COMPLETED",
        pagePath: "/dashboard",
        metadata: {
          accountAgeHours: Math.round(accountAgeHours),
        },
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
          accountAgeHours: Math.round(accountAgeHours),
        },
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
        actionsCount: advisor.shortTermActions.length,
        completionRate: consultiveAnalytics.completionRate,
      },
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
        netWorth: totals.netWorth,
      },
      upcomingBills: upcomingBills.map((transaction) => ({
        id: transaction.id,
        description: transaction.description,
        dueDate:
          transaction.dueDate?.toISOString().slice(0, 10) ??
          transaction.postedAt.toISOString().slice(0, 10),
        amount: toNumber(transaction.amount),
      })),
      goals: goals.map((goal) => ({
        id: goal.id,
        name: goal.name,
        currentAmount: toNumber(goal.currentAmount),
        targetAmount: toNumber(goal.targetAmount),
        targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null,
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
          "Metas e patrimonio mostram seu progresso financeiro.",
        ],
        nudge: nextStep
          ? `Proximo passo: ${nextStep.title.toLowerCase()}.`
          : "Configuracao concluida. O painel agora reflete seus dados.",
      },
      insights: this.buildInsights({
        income,
        expenses,
        leftover,
        upcomingBillsAmount,
        topCategory,
        totalBudget,
        currentBudgetUsage,
      }),
      advisor,
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
  }): {
    priorityOfWeek: {
      id: string;
      title: string;
      route: string;
      cta: string;
      dueDate: string | null;
      score: number;
    };
    mainAttention: string;
    shortTermActions: AdvisorActionDraft[];
    riskSummary: {
      level: "baixo" | "moderado" | "alto" | "critico";
      score: number;
      label: string;
      description: string;
    };
    monthlyActionPlan: {
      title: string;
      subtitle: string;
      actions: AdvisorActionDraft[];
    };
    routine: {
      weeklyPriority: string;
      monthReview: string;
      goalConsistency: string;
      followUpReminder: string;
    };
  } {
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
          typeof metadata.dueDate === "string" ? metadata.dueDate : reviewAt;
        const amountCandidates = [
          metadata.amountRounded,
          metadata.spentRounded,
          metadata.remaining,
          metadata.projectedBalance,
          metadata.currentExpenses,
        ]
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .map((value) => Math.abs(value));
        const impactAmount =
          amountCandidates.length > 0 ? Math.max(...amountCandidates) : 0;
        const severityScore =
          alert.severity === "CRITICAL"
            ? 100
            : alert.severity === "WARNING"
              ? 70
              : 45;
        const urgencyScore = dueDate
          ? this.urgencyScore(input.now, dueDate)
          : 10;
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
          source: "alerta",
          type: alert.type,
          title,
          message: reason,
          recommendation: title,
          route: alert.actionRoute ?? "/dashboard",
          cta: alert.actionLabel ?? "Ver detalhe",
          dueDate,
          score,
          impactEstimate,
          context: {
            alertId: alert.id,
            severity: alert.severity,
            dueDate,
            impactEstimate,
            route: alert.actionRoute ?? "/dashboard",
            cta: alert.actionLabel ?? "Ver detalhe",
          },
        };
      })
      .sort((a, b) => b.score - a.score);

    const shortTermActions = actionable.slice(0, 3);
    const topAction = shortTermActions[0] ?? {
      id: "monthly-review",
      source: "plano",
      type: "BEHAVIOR",
      title: "Fazer revisao financeira da semana",
      message: "Revisao frequente melhora previsibilidade e reduz surpresas.",
      recommendation:
        "Abra os relatorios e ajuste gastos variaveis desta semana.",
      route: "/reports",
      cta: "Abrir relatorios",
      dueDate: input.now.toISOString().slice(0, 10),
      score: 70,
      impactEstimate: "Objetivo: manter consistencia e evitar desvios.",
      context: {
        fallback: true,
        route: "/reports",
        cta: "Abrir relatorios",
        impactEstimate: "Objetivo: manter consistencia e evitar desvios.",
      },
    };
    const criticalCount = actionable.filter((item) => item.score >= 145).length;
    const warningCount = actionable.filter(
      (item) => item.score >= 110 && item.score < 145,
    ).length;
    const riskScore = Math.min(
      100,
      Math.max(
        15,
        Math.round(
          criticalCount * 28 +
            warningCount * 12 +
            (input.leftover < 0 ? 18 : 0) +
            (input.currentBudgetUsage > 1
              ? 16
              : input.currentBudgetUsage > 0.85
                ? 8
                : 0),
        ),
      ),
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
        score: topAction.score,
      },
      mainAttention: topAction.message,
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
              : "Sem sinais urgentes no momento.",
      },
      monthlyActionPlan: {
        title: "Plano de acao do mes",
        subtitle:
          "As 3 acoes mais relevantes para manter sua saude financeira.",
        actions: shortTermActions,
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
          "Reserve 10 minutos na semana para revisar alertas, metas e proxima fatura.",
      },
    };
  }

  private async syncAdvisoryActions(
    userId: string,
    drafts: AdvisorActionDraft[],
    now: Date,
  ) {
    const store = this.advisoryActionStore();
    const eventStore = this.advisoryActionEventStore();
    for (const draft of drafts) {
      const existing = await store.findFirst({
        where: {
          userId,
          sourceRef: draft.id,
        },
      });
      const dueDate = draft.dueDate ? new Date(draft.dueDate) : null;
      const data = {
        source: draft.source,
        sourceRef: draft.id,
        type: draft.type,
        title: draft.title,
        message: draft.message,
        recommendation: draft.recommendation,
        priority: draft.score,
        dueDate,
        financialContext: {
          ...draft.context,
          route: draft.route,
          cta: draft.cta,
          impactEstimate: draft.impactEstimate,
        } as Prisma.InputJsonValue,
      };
      if (!existing) {
        const created = await store.create({
          data: {
            userId,
            ...data,
          },
        });
        await eventStore.create({
          data: {
            userId,
            advisoryActionId: created.id,
            fromStatus: null,
            toStatus: "SUGGESTED",
            metadata: { createdAt: now.toISOString() } as Prisma.InputJsonValue,
          },
        });
        continue;
      }
      if (["DISMISSED", "EXPIRED"].includes(existing.status)) {
        continue;
      }
      await store.update({
        where: { id: existing.id },
        data,
      });
    }
    const activeRefs = drafts.map((item) => item.id);
    const staleActions = await store.findMany({
      where: {
        userId,
        status: {
          in: ["SUGGESTED", "VIEWED", "POSTPONED"],
        },
        ...(activeRefs.length > 0
          ? {
              sourceRef: {
                notIn: activeRefs,
              },
            }
          : {}),
        updatedAt: {
          lt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        },
      },
      take: 30,
      orderBy: { updatedAt: "asc" },
    });
    for (const stale of staleActions) {
      await store.update({
        where: { id: stale.id },
        data: {
          status: "EXPIRED",
          resolvedAt: now,
        },
      });
      await eventStore.create({
        data: {
          userId,
          advisoryActionId: stale.id,
          fromStatus: stale.status,
          toStatus: "EXPIRED",
          metadata: {
            reason: "source_missing_or_stale",
          } as Prisma.InputJsonValue,
        },
      });
    }
  }

  private async loadActionPlan(
    userId: string,
    now: Date,
  ): Promise<AdvisorActionDraft[]> {
    const actions = await this.advisoryActionStore().findMany({
      where: {
        userId,
        status: {
          in: ["SUGGESTED", "VIEWED", "POSTPONED", "COMPLETED", "DISMISSED"],
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 12,
    });
    return actions
      .filter((action) => {
        if (["COMPLETED", "DISMISSED"].includes(action.status)) {
          return action.resolvedAt
            ? action.resolvedAt.getTime() >=
                now.getTime() - 14 * 24 * 60 * 60 * 1000
            : false;
        }
        if (
          action.status === "POSTPONED" &&
          action.postponedUntil &&
          action.postponedUntil > now
        ) {
          return true;
        }
        return ["SUGGESTED", "VIEWED", "POSTPONED"].includes(action.status);
      })
      .slice(0, 6)
      .map((action) => ({
        id: action.id,
        source: action.source,
        type: action.type,
        title: action.title,
        message: action.message,
        recommendation: action.recommendation,
        route: this.readContextRoute(action.financialContext),
        cta: this.readContextCta(action.financialContext),
        dueDate: action.dueDate
          ? action.dueDate.toISOString().slice(0, 10)
          : null,
        score: action.priority,
        impactEstimate:
          action.impactSummary ??
          this.readContextImpact(action.financialContext),
        context: {
          ...(this.parseJson(action.financialContext) ?? {}),
          status: action.status.toLowerCase(),
          feedback: action.feedback,
          postponedUntil: action.postponedUntil?.toISOString() ?? null,
          resolvedAt: action.resolvedAt?.toISOString() ?? null,
          suggestionTone: action.suggestionTone,
        },
      }));
  }

  private async setAdvisoryActionStatus(
    auth: AuthenticatedRequestContext,
    actionRef: string,
    target: ActionStatus,
    input?: {
      note?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const store = this.advisoryActionStore();
    const eventStore = this.advisoryActionEventStore();
    const action = await store.findFirst({
      where: {
        userId: auth.userId,
        OR: [{ id: actionRef }, { sourceRef: actionRef }],
      },
    });
    if (!action) {
      throw new NotFoundException("Acao consultiva nao encontrada.");
    }
    const now = new Date();
    const metadata = input?.metadata ?? {};
    const postponedUntilIso =
      typeof metadata.postponedUntil === "string"
        ? metadata.postponedUntil
        : null;
    const postponedUntil = postponedUntilIso
      ? new Date(postponedUntilIso)
      : null;
    const impact =
      target === "COMPLETED"
        ? await this.evaluateImpact(auth.userId, action)
        : null;
    const updated = await store.update({
      where: { id: action.id },
      data: {
        status: target,
        viewedAt: target === "VIEWED" ? now : action.viewedAt,
        postponedUntil: target === "POSTPONED" ? postponedUntil : null,
        resolvedAt: ["COMPLETED", "DISMISSED", "EXPIRED"].includes(target)
          ? now
          : null,
        feedback: input?.note ?? action.feedback,
        impactSummary: impact?.summary ?? action.impactSummary,
        impactScore: impact?.score ?? action.impactScore,
        suggestionTone: this.resolveSuggestionTone(target),
        updatedAt: now,
      },
    });
    await eventStore.create({
      data: {
        userId: auth.userId,
        advisoryActionId: action.id,
        fromStatus: action.status,
        toStatus: target,
        note: input?.note ?? null,
        metadata: {
          ...metadata,
          impactScore: impact?.score ?? null,
          impactSummary: impact?.summary ?? null,
        } as Prisma.InputJsonValue,
      },
    });
    return updated;
  }

  private async evaluateImpact(userId: string, action: AdvisoryActionRecord) {
    const now = new Date();
    if (action.type === "CASHFLOW" || action.type === "DEBT") {
      const overdueCount = await this.prisma.transaction.count({
        where: {
          userId,
          dueDate: { lt: now },
          status: { not: "CLEARED" },
          type: { in: ["EXPENSE", "CREDIT_CARD_PAYMENT", "LIABILITY_PAYMENT"] },
        },
      });
      const score = Math.max(0, 100 - overdueCount * 20);
      return {
        score,
        summary:
          overdueCount === 0
            ? "Sem contas vencidas apos a execucao da acao."
            : `${overdueCount} conta(s) ainda vencida(s).`,
      };
    }
    if (action.type === "BUDGET") {
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const [budgets, expenses] = await Promise.all([
        this.prisma.budget.findMany({
          where: {
            userId,
            isArchived: false,
            periodStart: { lte: monthEnd },
            periodEnd: { gte: monthStart },
          },
        }),
        this.prisma.transaction.findMany({
          where: {
            userId,
            postedAt: { gte: monthStart, lte: monthEnd },
            status: "CLEARED",
          },
        }),
      ]);
      const totalBudget = budgets.reduce(
        (sum, item) => sum + toNumber(item.amountLimit),
        0,
      );
      const totalExpense = expenses
        .filter((item) => isOutflow(item.type))
        .reduce((sum, item) => sum + toNumber(item.amount), 0);
      const usage = totalBudget > 0 ? totalExpense / totalBudget : 0;
      const score = Math.max(0, 100 - Math.round(usage * 100));
      return {
        score,
        summary: `Uso atual do orcamento: ${Math.round(usage * 100)}%.`,
      };
    }
    if (action.type === "GOAL") {
      const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const contributions = await this.prisma.goalContribution.count({
        where: {
          userId,
          contributionDate: { gte: since },
        },
      });
      return {
        score: Math.min(100, contributions * 20),
        summary:
          contributions > 0
            ? `${contributions} aporte(s) em metas nos ultimos 30 dias.`
            : "Nenhum aporte recente em metas.",
      };
    }
    const recentDismiss = await this.advisoryActionEventStore().findMany({
      where: {
        userId,
        toStatus: "DISMISSED",
        occurredAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
    });
    const score = Math.max(20, 100 - recentDismiss.length * 10);
    return {
      score,
      summary: `Recorrencia de descarte recente: ${recentDismiss.length} acao(oes).`,
    };
  }

  private async expireOverdueActions(userId: string, now: Date) {
    const result = await this.advisoryActionStore().updateMany({
      where: {
        userId,
        status: {
          in: ["SUGGESTED", "VIEWED", "POSTPONED"],
        },
        OR: [
          {
            dueDate: {
              lt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            },
          },
          {
            postponedUntil: {
              lt: now,
            },
          },
        ],
      },
      data: {
        status: "EXPIRED",
        resolvedAt: now,
      },
    });
    if (result.count === 0) {
      return;
    }
    await this.engagementAnalytics.record({
      userId,
      source: "dashboard_action_plan",
      eventName: "action_expired",
      metadata: { count: result.count },
    });
  }

  private async buildBehaviorProfile(userId: string) {
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const events = await this.advisoryActionEventStore().findMany({
      where: {
        userId,
        occurredAt: { gte: since },
      },
      include: {
        advisoryAction: true,
      },
    } as unknown as Record<string, unknown>);
    const byType = new Map<
      string,
      {
        completed: number;
        dismissed: number;
        postponed: number;
        viewed: number;
        total: number;
      }
    >();
    for (const event of events as Array<
      AdvisoryActionEventRecord & { advisoryAction?: AdvisoryActionRecord }
    >) {
      const type = event.advisoryAction?.type ?? "UNKNOWN";
      const bucket = byType.get(type) ?? {
        completed: 0,
        dismissed: 0,
        postponed: 0,
        viewed: 0,
        total: 0,
      };
      bucket.total += 1;
      if (event.toStatus === "COMPLETED") bucket.completed += 1;
      if (event.toStatus === "DISMISSED") bucket.dismissed += 1;
      if (event.toStatus === "POSTPONED") bucket.postponed += 1;
      if (event.toStatus === "VIEWED") bucket.viewed += 1;
      byType.set(type, bucket);
    }
    const entries = [...byType.entries()].map(([type, metrics]) => ({
      type,
      completedRate: metrics.total > 0 ? metrics.completed / metrics.total : 0,
      dismissedRate: metrics.total > 0 ? metrics.dismissed / metrics.total : 0,
      postponedRate: metrics.total > 0 ? metrics.postponed / metrics.total : 0,
      totalInteractions: metrics.total,
    }));
    const strongTypes = entries
      .filter(
        (item) => item.completedRate >= 0.35 && item.totalInteractions >= 3,
      )
      .map((item) => item.type);
    const weakTypes = entries
      .filter(
        (item) => item.dismissedRate >= 0.35 && item.totalInteractions >= 3,
      )
      .map((item) => item.type);
    return {
      strongTypes,
      weakTypes,
      byType: entries,
    };
  }

  private applyBehaviorAdaptation(
    actions: AdvisorActionDraft[],
    profile: {
      strongTypes: string[];
      weakTypes: string[];
      byType: Array<{
        type: string;
        completedRate: number;
        dismissedRate: number;
        postponedRate: number;
        totalInteractions: number;
      }>;
    },
    now: Date,
  ): AdvisorActionDraft[] {
    const metricsByType = new Map(
      profile.byType.map((item) => [item.type, item]),
    );
    const adapted = actions.map((action) => {
      const metrics = metricsByType.get(action.type);
      const boost = metrics ? Math.round(metrics.completedRate * 18) : 0;
      const penalty = metrics
        ? Math.round(metrics.dismissedRate * 16 + metrics.postponedRate * 8)
        : 0;
      const urgency = action.dueDate
        ? this.urgencyScore(now, action.dueDate)
        : 0;
      const score = Math.max(
        20,
        action.score + boost - penalty + Math.round(urgency * 0.4),
      );
      const tone = this.resolveToneByMetrics(metrics);
      return {
        ...action,
        message:
          tone === "encorajador"
            ? `Passo leve: ${action.message}`
            : action.message,
        score,
        context: {
          ...action.context,
          suggestionTone: tone,
        },
      };
    });
    return adapted.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  private async buildConsultiveAnalytics(userId: string, now: Date) {
    const since = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const weeklySince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousWeeklyStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const events = await this.advisoryActionEventStore().findMany({
      where: {
        userId,
        occurredAt: { gte: since },
      },
      include: {
        advisoryAction: true,
      },
      orderBy: { occurredAt: "desc" },
      take: 300,
    } as unknown as Record<string, unknown>);
    const completed = events.filter((event) => event.toStatus === "COMPLETED");
    const postponed = events.filter((event) => event.toStatus === "POSTPONED");
    const dismissed = events.filter((event) => event.toStatus === "DISMISSED");
    const viewed = events.filter((event) => event.toStatus === "VIEWED");
    const weeklyCompleted = completed.filter((event) => event.occurredAt >= weeklySince);
    const weeklyViewed = viewed.filter((event) => event.occurredAt >= weeklySince);
    const avgMinutes = completed.length
      ? Math.round(
          completed.reduce((sum, event) => {
            const withAction = event as AdvisoryActionEventRecord & {
              advisoryAction?: AdvisoryActionRecord;
            };
            const createdAt =
              withAction.advisoryAction?.createdAt ?? withAction.occurredAt;
            return (
              sum +
              Math.max(
                0,
                withAction.occurredAt.getTime() - createdAt.getTime(),
              ) /
                (1000 * 60)
            );
          }, 0) / completed.length,
        )
      : null;
    const engagementByType = new Map<
      string,
      { acted: number; ignored: number }
    >();
    for (const event of events as Array<
      AdvisoryActionEventRecord & { advisoryAction?: AdvisoryActionRecord }
    >) {
      const type = event.advisoryAction?.type ?? "UNKNOWN";
      const bucket = engagementByType.get(type) ?? { acted: 0, ignored: 0 };
      if (event.toStatus === "COMPLETED") bucket.acted += 1;
      if (event.toStatus === "DISMISSED") bucket.ignored += 1;
      engagementByType.set(type, bucket);
    }
    const byType = [...engagementByType.entries()].map(([type, value]) => ({
      type,
      acted: value.acted,
      ignored: value.ignored,
    }));
    const [
      pendingActions,
      recentRiskAlerts,
      previousRiskAlerts,
      weeklyGoalContributions,
      completedActionsForImpact,
      overdueTransactions,
    ] = await Promise.all([
      this.advisoryActionStore().findMany({
        where: {
          userId,
          status: {
            in: ["SUGGESTED", "VIEWED", "POSTPONED"],
          },
        },
      }),
      this.prisma.alert.count({
        where: {
          userId,
          severity: { in: ["CRITICAL", "WARNING"] },
          dismissedAt: null,
          triggerDate: { gte: weeklySince },
        },
      }),
      this.prisma.alert.count({
        where: {
          userId,
          severity: { in: ["CRITICAL", "WARNING"] },
          dismissedAt: null,
          triggerDate: { gte: previousWeeklyStart, lt: weeklySince },
        },
      }),
      this.prisma.goalContribution.count({
        where: {
          userId,
          contributionDate: { gte: weeklySince },
        },
      }),
      this.advisoryActionStore().findMany({
        where: {
          userId,
          status: "COMPLETED",
          resolvedAt: { gte: since },
        },
        orderBy: { resolvedAt: "desc" },
        take: 60,
      }),
      this.prisma.transaction.count({
        where: {
          userId,
          dueDate: { lt: now },
          status: { not: "CLEARED" },
          type: { in: ["EXPENSE", "CREDIT_CARD_PAYMENT", "LIABILITY_PAYMENT"] },
        },
      }),
    ]);
    const averageImpactScore =
      completedActionsForImpact.length > 0
        ? Math.round(
            completedActionsForImpact.reduce(
              (sum, item) => sum + (item.impactScore ?? 0),
              0,
            ) / completedActionsForImpact.length,
          )
        : null;
    const riskDirection =
      recentRiskAlerts < previousRiskAlerts
        ? "queda"
        : recentRiskAlerts > previousRiskAlerts
          ? "alta"
          : "estavel";
    const recurringAlertsDelta =
      previousRiskAlerts > 0
        ? Number(
            (
              ((recentRiskAlerts - previousRiskAlerts) / previousRiskAlerts) *
              100
            ).toFixed(1),
          )
        : 0;
    const highlights: string[] = [];
    if (weeklyCompleted.length > 0) {
      highlights.push(
        `${weeklyCompleted.length} acao(oes) concluida(s) nesta semana.`,
      );
    }
    if (riskDirection === "queda") {
      highlights.push("O volume de alertas de risco caiu na ultima semana.");
    }
    if (weeklyGoalContributions > 0) {
      highlights.push(
        `${weeklyGoalContributions} aporte(s) em metas nos ultimos 7 dias.`,
      );
    }
    if (averageImpactScore !== null && averageImpactScore >= 65) {
      highlights.push("As acoes executadas estao gerando impacto positivo.");
    }
    const attentionPoints: string[] = [];
    if (pendingActions.length > 0) {
      attentionPoints.push(`${pendingActions.length} acao(oes) ainda pendente(s).`);
    }
    if (postponed.length > completed.length) {
      attentionPoints.push(
        "Ha mais adiamentos do que conclusoes no periodo recente.",
      );
    }
    if (riskDirection === "alta") {
      attentionPoints.push("Os alertas de risco aumentaram na ultima semana.");
    }
    if (overdueTransactions > 0) {
      attentionPoints.push(
        `${overdueTransactions} conta(s) vencida(s) ainda sem regularizacao.`,
      );
    }
    return {
      completedCount: completed.length,
      postponedCount: postponed.length,
      dismissedCount: dismissed.length,
      viewedCount: viewed.length,
      pendingCount: pendingActions.length,
      weeklyCompletedCount: weeklyCompleted.length,
      weeklyViewedCount: weeklyViewed.length,
      avgActionTimeMinutes: avgMinutes,
      averageImpactScore,
      riskDirection,
      recurringAlertsDelta,
      completionRate:
        viewed.length > 0
          ? Math.min(1, Number((completed.length / viewed.length).toFixed(4)))
          : 0,
      highlights,
      attentionPoints,
      byType,
    };
  }

  private resolveSuggestionTone(status: ActionStatus) {
    if (status === "COMPLETED") return "objetivo";
    if (status === "POSTPONED") return "encorajador";
    if (status === "DISMISSED") return "direto";
    return "objetivo";
  }

  private resolveToneByMetrics(metrics?: {
    completedRate: number;
    dismissedRate: number;
    postponedRate: number;
  }) {
    if (!metrics) return "objetivo";
    if (metrics.dismissedRate >= 0.35) return "direto";
    if (metrics.postponedRate >= 0.3) return "encorajador";
    return "objetivo";
  }

  private parseJson(input: unknown): Record<string, unknown> | null {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return null;
    }
    return input as Record<string, unknown>;
  }

  private readContextRoute(context: unknown) {
    const parsed = this.parseJson(context);
    return typeof parsed?.route === "string" ? parsed.route : "/dashboard";
  }

  private readContextCta(context: unknown) {
    const parsed = this.parseJson(context);
    return typeof parsed?.cta === "string" ? parsed.cta : "Ver detalhe";
  }

  private readContextImpact(context: unknown) {
    const parsed = this.parseJson(context);
    return typeof parsed?.impactEstimate === "string"
      ? parsed.impactEstimate
      : "Acao com potencial de melhorar previsibilidade financeira.";
  }

  private urgencyScore(now: Date, referenceDateIso: string) {
    const target = new Date(referenceDateIso);
    if (Number.isNaN(target.getTime())) return 10;
    const diffDays = Math.floor(
      (target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );
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
        description: `Essa categoria concentrou R$ ${Math.round(input.topCategory[1])} no mes atual.`,
      });
    }

    if (input.upcomingBillsAmount > 0) {
      insights.push({
        id: "upcoming-bills",
        title: "Ainda ha contas a vencer neste mes",
        description: `Voce ainda precisa cobrir R$ ${Math.round(input.upcomingBillsAmount)} ate o fechamento.`,
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
          : `Mantendo o ritmo atual, faltam R$ ${Math.round(Math.abs(input.leftover))}.`,
    });

    if (input.totalBudget > 0) {
      insights.push({
        id: "budget-usage",
        title:
          input.currentBudgetUsage > 0.85
            ? "Seu orcamento do mes esta apertado"
            : "Seu orcamento ainda esta sob controle",
        description: `Voce consumiu ${Math.round(input.currentBudgetUsage * 100)}% do limite planejado.`,
      });
    }

    return insights.slice(0, 4);
  }
}
