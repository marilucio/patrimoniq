import { Injectable, Logger } from "@nestjs/common";
import { AlertSeverity, AlertType, Prisma } from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import {
  endOfMonth,
  isInflow,
  isOutflow,
  startOfMonth,
  toNumber,
} from "../../common/finance.utils";
import { NotificationService } from "../../common/notification.service";
import { PrismaService } from "../../common/prisma.service";

export interface AlertRecommendation {
  whatHappened: string;
  whyItMatters: string;
  whatToDoNow: string;
  reviewAt: string;
}

interface AlertRule {
  type: AlertType;
  severity: AlertSeverity;
  dedupeKey: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
  metadata?: Record<string, unknown>;
  recommendation: AlertRecommendation;
  goalId?: string;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async list(auth: AuthenticatedRequestContext) {
    const alerts = await this.prisma.alert.findMany({
      where: {
        userId: auth.userId,
        dismissedAt: null,
      },
      orderBy: [{ severity: "desc" }, { triggerDate: "desc" }],
      take: 20,
    });

    return {
      items: alerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        actionLabel: alert.actionLabel,
        actionRoute: alert.actionRoute,
        recommendation: this.parseRecommendation(alert.metadata),
        isRead: Boolean(alert.acknowledgedAt),
        triggerDate: alert.triggerDate.toISOString(),
        createdAt: alert.createdAt.toISOString(),
      })),
      unreadCount: alerts.filter((a) => !a.acknowledgedAt).length,
    };
  }

  async acknowledge(auth: AuthenticatedRequestContext, alertId: string) {
    await this.prisma.alert.updateMany({
      where: {
        id: alertId,
        userId: auth.userId,
        acknowledgedAt: null,
      },
      data: { acknowledgedAt: new Date() },
    });

    return { success: true };
  }

  async dismiss(auth: AuthenticatedRequestContext, alertId: string) {
    await this.prisma.alert.updateMany({
      where: {
        id: alertId,
        userId: auth.userId,
        dismissedAt: null,
      },
      data: { dismissedAt: new Date() },
    });

    return { success: true };
  }

  async acknowledgeAll(auth: AuthenticatedRequestContext) {
    const result = await this.prisma.alert.updateMany({
      where: {
        userId: auth.userId,
        acknowledgedAt: null,
        dismissedAt: null,
      },
      data: { acknowledgedAt: new Date() },
    });

    return { success: true, count: result.count };
  }

  /**
   * Runs all alert rules for the user and creates/updates alerts.
   * Called on dashboard load to keep alerts fresh.
   */
  async evaluate(auth: AuthenticatedRequestContext) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [transactions, budgets, goals, accounts] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId: auth.userId,
          postedAt: { gte: monthStart, lte: monthEnd },
          status: { not: "CANCELED" },
        },
        include: { category: true },
      }),
      this.prisma.budget.findMany({
        where: {
          userId: auth.userId,
          isArchived: false,
          periodStart: { lte: monthEnd },
          periodEnd: { gte: monthStart },
        },
        include: { category: true, subcategory: true },
      }),
      this.prisma.goal.findMany({
        where: {
          userId: auth.userId,
          status: "ACTIVE",
        },
      }),
      this.prisma.account.findMany({
        where: {
          userId: auth.userId,
          isArchived: false,
        },
      }),
    ]);

    const alerts: AlertRule[] = [];

    // ── Rule 1: Bills due soon ──
    const upcomingBills = transactions.filter(
      (t) =>
        isOutflow(t.type) &&
        t.status !== "CLEARED" &&
        t.dueDate &&
        t.dueDate >= now &&
        t.dueDate <= new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    );

    for (const bill of upcomingBills) {
      const dueLabel = bill.dueDate!.toISOString().slice(0, 10);
      alerts.push({
        type: "CASHFLOW",
        severity: "WARNING",
        dedupeKey: `bill-due:${bill.id}`,
        title: `${bill.description} vence em breve`,
        message: `Vencimento em ${dueLabel}. Valor: R$ ${Math.round(toNumber(bill.amount))}.`,
        actionLabel: "Ver lancamentos",
        actionRoute: "/transactions",
        metadata: {
          transactionId: bill.id,
          dueDate: dueLabel,
          amountRounded: Math.round(toNumber(bill.amount)),
        },
        recommendation: {
          whatHappened: `A conta "${bill.description}" vence em ${dueLabel}.`,
          whyItMatters:
            "Antecipar esse pagamento evita juros e protege seu fluxo de caixa.",
          whatToDoNow: "Reserve o valor e programe o pagamento ainda hoje.",
          reviewAt: dueLabel,
        },
      });
    }

    // ── Rule 2: Overdue bills ──
    const overdueBills = transactions.filter(
      (t) =>
        isOutflow(t.type) &&
        t.status !== "CLEARED" &&
        t.dueDate &&
        t.dueDate < now,
    );

    for (const bill of overdueBills.slice(0, 3)) {
      alerts.push({
        type: "CASHFLOW",
        severity: "CRITICAL",
        dedupeKey: `bill-overdue:${bill.id}`,
        title: `${bill.description} esta vencida`,
        message: `Venceu em ${bill.dueDate!.toISOString().slice(0, 10)}. Valor: R$ ${Math.round(toNumber(bill.amount))}.`,
        actionLabel: "Ver lancamentos",
        actionRoute: "/transactions",
        metadata: {
          transactionId: bill.id,
          dueDate: bill.dueDate!.toISOString().slice(0, 10),
          amountRounded: Math.round(toNumber(bill.amount)),
        },
        recommendation: {
          whatHappened: `A conta "${bill.description}" ja passou do vencimento.`,
          whyItMatters:
            "Contas vencidas podem gerar multa, juros e queda de previsibilidade.",
          whatToDoNow:
            "Regularize o pagamento agora e confirme a baixa no sistema.",
          reviewAt: this.plusDaysLabel(now, 1),
        },
      });
    }

    // ── Rule 3: Budget near limit ──
    for (const budget of budgets) {
      const spent = transactions
        .filter(
          (t) =>
            t.status === "CLEARED" &&
            isOutflow(t.type) &&
            (budget.categoryId ? t.categoryId === budget.categoryId : true) &&
            (budget.subcategoryId
              ? t.subcategoryId === budget.subcategoryId
              : true),
        )
        .reduce((sum, t) => sum + toNumber(t.amount), 0);

      const limit = toNumber(budget.amountLimit);
      if (limit <= 0) continue;

      const usage = spent / limit;
      const threshold = (budget.alertThresholdPercent ?? 85) / 100;

      if (usage >= 1) {
        alerts.push({
          type: "BUDGET",
          severity: "CRITICAL",
          dedupeKey: `budget-exceeded:${budget.id}`,
          title: `Orcamento "${budget.name}" estourado`,
          message: `Voce gastou R$ ${Math.round(spent)} de R$ ${Math.round(limit)} (${Math.round(usage * 100)}%).`,
          actionLabel: "Ver orcamentos",
          actionRoute: "/budgets",
          metadata: {
            budgetId: budget.id,
            budgetName: budget.name,
            usage: Math.round(usage * 100),
            spentRounded: Math.round(spent),
            limitRounded: Math.round(limit),
          },
          recommendation: {
            whatHappened: `O orcamento "${budget.name}" ultrapassou o limite.`,
            whyItMatters:
              "Estouro recorrente reduz margem de seguranca no fim do mes.",
            whatToDoNow:
              "Pause gastos dessa categoria e revise os proximos lancamentos.",
            reviewAt: this.plusDaysLabel(now, 2),
          },
        });
      } else if (usage >= threshold) {
        alerts.push({
          type: "BUDGET",
          severity: "WARNING",
          dedupeKey: `budget-near:${budget.id}`,
          title: `Orcamento "${budget.name}" proximo do limite`,
          message: `Ja consumiu ${Math.round(usage * 100)}% do limite de R$ ${Math.round(limit)}.`,
          actionLabel: "Ver orcamentos",
          actionRoute: "/budgets",
          metadata: {
            budgetId: budget.id,
            budgetName: budget.name,
            usage: Math.round(usage * 100),
            spentRounded: Math.round(spent),
            limitRounded: Math.round(limit),
          },
          recommendation: {
            whatHappened: `O orcamento "${budget.name}" esta perto do limite.`,
            whyItMatters:
              "Com pouca margem, qualquer gasto extra pode virar estouro.",
            whatToDoNow:
              "Revise despesas variaveis e limite novos gastos desta categoria.",
            reviewAt: this.plusDaysLabel(now, 3),
          },
        });
      }
    }

    // ── Rule 4: Goal without recent contribution ──
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    for (const goal of goals) {
      const target = toNumber(goal.targetAmount);
      const current = toNumber(goal.currentAmount);
      if (current >= target) continue;

      const lastContribution = await this.prisma.goalContribution.findFirst({
        where: { goalId: goal.id },
        orderBy: { contributionDate: "desc" },
      });

      if (
        !lastContribution ||
        lastContribution.contributionDate < twoWeeksAgo
      ) {
        alerts.push({
          type: "GOAL",
          severity: "INFO",
          dedupeKey: `goal-stale:${goal.id}`,
          title: `Meta "${goal.name}" sem aporte recente`,
          message: `Faltam R$ ${Math.round(target - current)} para atingir o objetivo.`,
          actionLabel: "Ver metas",
          actionRoute: "/goals",
          goalId: goal.id,
          metadata: {
            goalId: goal.id,
            remaining: Math.round(target - current),
          },
          recommendation: {
            whatHappened: `A meta "${goal.name}" ficou sem aporte recente.`,
            whyItMatters:
              "Sem recorrencia de aportes, o prazo da meta tende a escorregar.",
            whatToDoNow:
              "Defina um aporte minimo para esta semana e registre o compromisso.",
            reviewAt: this.plusDaysLabel(now, 7),
          },
        });
      }
    }

    // ── Rule 5: Negative projected balance ──
    const income = transactions
      .filter((t) => t.status === "CLEARED" && isInflow(t.type))
      .reduce((sum, t) => sum + toNumber(t.amount), 0);
    const expenses = transactions
      .filter((t) => t.status === "CLEARED" && isOutflow(t.type))
      .reduce((sum, t) => sum + toNumber(t.amount), 0);
    const pendingExpenses = transactions
      .filter(
        (t) =>
          isOutflow(t.type) &&
          t.status !== "CLEARED" &&
          t.status !== "CANCELED",
      )
      .reduce((sum, t) => sum + toNumber(t.amount), 0);
    const projectedBalance = income - expenses - pendingExpenses;

    if (projectedBalance < 0) {
      alerts.push({
        type: "CASHFLOW",
        severity: "CRITICAL",
        dedupeKey: `projected-negative:${now.getFullYear()}-${now.getMonth()}`,
        title: "Saldo projetado negativo",
        message: `Com os compromissos pendentes, o saldo projetado fica em R$ ${Math.round(projectedBalance)}.`,
        actionLabel: "Ver visao geral",
        actionRoute: "/dashboard",
        metadata: { projectedBalance: Math.round(projectedBalance) },
        recommendation: {
          whatHappened: "Seu saldo projetado do periodo esta negativo.",
          whyItMatters:
            "Esse sinal indica risco de faltar caixa para compromissos ja previstos.",
          whatToDoNow:
            "Adie gastos nao essenciais e priorize quitar despesas obrigatorias.",
          reviewAt: this.plusDaysLabel(now, 2),
        },
      });
    }

    // ── Rule 6: Spending above recent average ──
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );
    const prevMonthTransactions = await this.prisma.transaction.findMany({
      where: {
        userId: auth.userId,
        postedAt: { gte: prevMonthStart, lte: prevMonthEnd },
        status: "CLEARED",
      },
    });

    const prevExpenses = prevMonthTransactions
      .filter((t) => isOutflow(t.type))
      .reduce((sum, t) => sum + toNumber(t.amount), 0);

    if (prevExpenses > 0 && expenses > prevExpenses * 1.3) {
      const increase = Math.round(
        ((expenses - prevExpenses) / prevExpenses) * 100,
      );
      alerts.push({
        type: "BEHAVIOR",
        severity: "WARNING",
        dedupeKey: `spending-above-avg:${now.getFullYear()}-${now.getMonth()}`,
        title: "Gastos acima da media",
        message: `Suas despesas estao ${increase}% acima do mes anterior.`,
        actionLabel: "Ver relatorios",
        actionRoute: "/reports",
        metadata: {
          increase,
          currentExpenses: Math.round(expenses),
          previousExpenses: Math.round(prevExpenses),
        },
        recommendation: {
          whatHappened: `As despesas subiram ${increase}% em relacao ao mes anterior.`,
          whyItMatters:
            "Quando esse ritmo persiste, sobra menos recurso para metas e reserva.",
          whatToDoNow:
            "Identifique os 3 maiores aumentos no relatorio e corte excessos imediatos.",
          reviewAt: this.plusDaysLabel(now, 7),
        },
      });
    }

    // ── Persist alerts via upsert (deduplication) ──
    await this.persistAlerts(auth.userId, alerts);
    const emailDispatch = await this.notificationService.dispatchAlertEmails({
      userId: auth.userId,
      alerts: alerts.map((alert) => ({
        dedupeKey: alert.dedupeKey,
        title: alert.title,
        metadata: alert.metadata,
      })),
      referenceDate: now,
    });

    return { evaluated: alerts.length, emailSent: emailDispatch.sent };
  }

  private async persistAlerts(userId: string, rules: AlertRule[]) {
    for (const rule of rules) {
      try {
        const existing = await this.prisma.alert.findFirst({
          where: {
            userId,
            metadata: { path: ["_dedupeKey"], equals: rule.dedupeKey },
          },
        });

        if (existing) {
          // Update message if changed, don't re-create
          if (
            existing.message !== rule.message ||
            existing.title !== rule.title
          ) {
            await this.prisma.alert.update({
              where: { id: existing.id },
              data: {
                title: rule.title,
                message: rule.message,
                metadata: {
                  ...((existing.metadata as Record<string, unknown>) ?? {}),
                  ...rule.metadata,
                  recommendation: rule.recommendation,
                  _dedupeKey: rule.dedupeKey,
                } as unknown as Prisma.InputJsonValue,
              },
            });
          }
          continue;
        }

        await this.prisma.alert.create({
          data: {
            userId,
            type: rule.type,
            severity: rule.severity,
            title: rule.title,
            message: rule.message,
            actionLabel: rule.actionLabel ?? null,
            actionRoute: rule.actionRoute ?? null,
            goalId: rule.goalId ?? null,
            metadata: {
              ...rule.metadata,
              recommendation: rule.recommendation,
              _dedupeKey: rule.dedupeKey,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Falha ao persistir alerta ${rule.dedupeKey}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private parseRecommendation(metadata: unknown): AlertRecommendation | null {
    if (!metadata || typeof metadata !== "object") return null;
    const data = metadata as Record<string, unknown>;
    const recommendation =
      data.recommendation && typeof data.recommendation === "object"
        ? (data.recommendation as Record<string, unknown>)
        : null;
    if (!recommendation) return null;
    const whatHappened = recommendation.whatHappened;
    const whyItMatters = recommendation.whyItMatters;
    const whatToDoNow = recommendation.whatToDoNow;
    const reviewAt = recommendation.reviewAt;
    if (
      typeof whatHappened !== "string" ||
      typeof whyItMatters !== "string" ||
      typeof whatToDoNow !== "string" ||
      typeof reviewAt !== "string"
    ) {
      return null;
    }
    return {
      whatHappened,
      whyItMatters,
      whatToDoNow,
      reviewAt,
    };
  }

  private plusDaysLabel(reference: Date, days: number) {
    return new Date(reference.getTime() + days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }
}
