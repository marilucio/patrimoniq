import { Injectable, Logger } from "@nestjs/common";
import {
  NotificationDeliveryChannel,
  NotificationDispatchStatus,
  NotificationEventType,
  Prisma
} from "@prisma/client";
import { EmailService } from "./email.service";
import {
  billDueReminderEmailTemplate,
  budgetAlertEmailTemplate,
  weeklyDigestEmailTemplate
} from "./email.templates";
import { isInflow, isOutflow, toNumber } from "./finance.utils";
import { PrismaService } from "./prisma.service";

export type NotificationChannel = "internal" | "email" | "push";

export interface NotificationPayload {
  userId: string;
  channel: NotificationChannel;
  type: "bill_due" | "budget_alert" | "weekly_digest";
  data: Record<string, unknown>;
}

interface AlertEmailCandidate {
  dedupeKey: string;
  title: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  /**
   * Dispatch a notification to a specific channel.
   * Internal alerts are handled by the AlertsService.
   * Email delivery is handled here.
   * Push is a no-op reserved for future implementation.
   */
  async dispatch(payload: NotificationPayload) {
    if (payload.channel === "internal") {
      // Internal alerts are managed by AlertsService directly
      return;
    }

    if (payload.channel === "push") {
      // Push notifications reserved for future implementation
      this.logger.debug(`Push notification skipped (not implemented): ${payload.type}`);
      return;
    }

    if (payload.channel === "email") {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, fullName: true }
      });
      if (!user) return;
      await this.sendEmailNotification(payload, user);
    }
  }

  async dispatchAlertEmails(input: {
    userId: string;
    alerts: AlertEmailCandidate[];
    referenceDate?: Date;
  }) {
    const now = input.referenceDate ?? new Date();
    const [user, preferences] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true, fullName: true }
      }),
      this.prisma.notificationPreference.findUnique({
        where: { userId: input.userId }
      })
    ]);

    if (!user) {
      return { attempted: 0, sent: 0 };
    }

    const effective = {
      emailAlerts: preferences?.emailAlerts ?? true,
      dueDateReminders: preferences?.dueDateReminders ?? true,
      budgetAlerts: preferences?.budgetAlerts ?? true
    };

    if (!effective.emailAlerts) {
      return { attempted: 0, sent: 0 };
    }

    let attempted = 0;
    let sent = 0;
    const dayBucket = this.dayBucket(now);

    for (const alert of input.alerts) {
      const email = this.buildAlertEmailPayload(input.userId, alert);
      if (!email) continue;

      if (
        (email.eventType === "BILL_DUE" || email.eventType === "BILL_OVERDUE") &&
        !effective.dueDateReminders
      ) {
        continue;
      }

      if (
        (email.eventType === "BUDGET_NEAR_LIMIT" || email.eventType === "BUDGET_EXCEEDED") &&
        !effective.budgetAlerts
      ) {
        continue;
      }

      attempted += 1;
      const dedupeKey = `${input.userId}:email:${email.eventType}:${alert.dedupeKey}:${dayBucket}`;
      const dispatch = await this.claimDispatch({
        userId: input.userId,
        channel: "EMAIL",
        eventType: email.eventType,
        dedupeKey,
        metadata: {
          alertDedupeKey: alert.dedupeKey,
          alertTitle: alert.title
        }
      });

      if (!dispatch) continue;

      try {
        await this.sendEmailNotification(
          {
            userId: input.userId,
            channel: "email",
            type: email.type,
            data: email.data
          },
          user
        );
        await this.markDispatchSent(dispatch.id);
        sent += 1;
      } catch (error) {
        await this.markDispatchFailed(dispatch.id, error);
      }
    }

    return { attempted, sent };
  }

  async sendWeeklyDigestBatch(referenceDate?: Date) {
    const now = referenceDate ?? new Date();
    const weekBucket = this.weekBucket(now);
    const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        emailAlerts: true,
        weeklyDigest: true
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        }
      }
    });

    let attempted = 0;
    let sent = 0;

    for (const preference of preferences) {
      attempted += 1;
      const user = preference.user;
      const dedupeKey = `${user.id}:email:WEEKLY_DIGEST:${weekBucket}`;
      const dispatch = await this.claimDispatch({
        userId: user.id,
        channel: "EMAIL",
        eventType: "WEEKLY_DIGEST",
        dedupeKey,
        metadata: {
          weekBucket
        }
      });

      if (!dispatch) continue;

      try {
        const transactions = await this.prisma.transaction.findMany({
          where: {
            userId: user.id,
            status: "CLEARED",
            postedAt: {
              gte: periodStart,
              lte: now
            }
          },
          select: {
            type: true,
            amount: true
          }
        });
        const income = transactions
          .filter((transaction) => isInflow(transaction.type))
          .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
        const expenses = transactions
          .filter((transaction) => isOutflow(transaction.type))
          .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
        const alertCount = await this.prisma.alert.count({
          where: {
            userId: user.id,
            dismissedAt: null,
            acknowledgedAt: null
          }
        });

        await this.sendEmailNotification(
          {
            userId: user.id,
            channel: "email",
            type: "weekly_digest",
            data: {
              income: this.formatMoney(income),
              expenses: this.formatMoney(expenses),
              balance: this.formatMoney(income - expenses),
              alertCount
            }
          },
          user
        );
        await this.markDispatchSent(dispatch.id);
        sent += 1;
      } catch (error) {
        await this.markDispatchFailed(dispatch.id, error);
      }
    }

    return { attempted, sent };
  }

  private async sendEmailNotification(
    payload: NotificationPayload,
    user: { id: string; email: string; fullName: string }
  ) {
    const appUrl =
      process.env.APP_PUBLIC_URL ?? process.env.FRONTEND_URL ?? "http://localhost:3000";

    try {
      if (payload.type === "bill_due") {
        const data = payload.data as {
          billDescription: string;
          dueDate: string;
          amount: string;
        };

        const template = billDueReminderEmailTemplate({
          fullName: user.fullName,
          billDescription: data.billDescription,
          dueDate: data.dueDate,
          amount: data.amount,
          appUrl
        });

        await this.emailService.send({
          to: user.email,
          subject: template.subject,
          text: template.text,
          html: template.html
        });
      }

      if (payload.type === "budget_alert") {
        const data = payload.data as {
          budgetName: string;
          usagePercent: number;
          spent: string;
          limit: string;
        };

        const template = budgetAlertEmailTemplate({
          fullName: user.fullName,
          budgetName: data.budgetName,
          usagePercent: data.usagePercent,
          spent: data.spent,
          limit: data.limit,
          appUrl
        });

        await this.emailService.send({
          to: user.email,
          subject: template.subject,
          text: template.text,
          html: template.html
        });
      }

      if (payload.type === "weekly_digest") {
        const data = payload.data as {
          income: string;
          expenses: string;
          balance: string;
          alertCount: number;
        };
        const template = weeklyDigestEmailTemplate({
          fullName: user.fullName,
          income: data.income,
          expenses: data.expenses,
          balance: data.balance,
          alertCount: data.alertCount,
          appUrl
        });

        await this.emailService.send({
          to: user.email,
          subject: template.subject,
          text: template.text,
          html: template.html
        });
      }
    } catch (error) {
      this.logger.warn(`Falha ao enviar e-mail de notificacao (${payload.type})`);
      throw error;
    }
  }

  private buildAlertEmailPayload(userId: string, alert: AlertEmailCandidate): {
    type: NotificationPayload["type"];
    eventType: NotificationEventType;
    data: Record<string, unknown>;
  } | null {
    if (alert.dedupeKey.startsWith("bill-due:")) {
      const metadata = alert.metadata ?? {};
      return {
        type: "bill_due",
        eventType: "BILL_DUE",
        data: {
          billDescription: alert.title.replace(" vence em breve", "").trim(),
          dueDate: String(metadata.dueDate ?? "-"),
          amount: String(metadata.amountRounded ?? "0")
        }
      };
    }

    if (alert.dedupeKey.startsWith("bill-overdue:")) {
      const metadata = alert.metadata ?? {};
      return {
        type: "bill_due",
        eventType: "BILL_OVERDUE",
        data: {
          billDescription: alert.title.replace(" esta vencida", "").trim(),
          dueDate: String(metadata.dueDate ?? "-"),
          amount: String(metadata.amountRounded ?? "0")
        }
      };
    }

    if (
      alert.dedupeKey.startsWith("budget-near:") ||
      alert.dedupeKey.startsWith("budget-exceeded:")
    ) {
      const metadata = alert.metadata ?? {};
      return {
        type: "budget_alert",
        eventType: alert.dedupeKey.startsWith("budget-exceeded:")
          ? "BUDGET_EXCEEDED"
          : "BUDGET_NEAR_LIMIT",
        data: {
          budgetName: String(metadata.budgetName ?? alert.title),
          usagePercent: Number(metadata.usage ?? 0),
          spent: String(metadata.spentRounded ?? "0"),
          limit: String(metadata.limitRounded ?? "0")
        }
      };
    }

    return null;
  }

  private async claimDispatch(input: {
    userId: string;
    channel: NotificationDeliveryChannel;
    eventType: NotificationEventType;
    dedupeKey: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      return await this.prisma.notificationDispatch.create({
        data: {
          userId: input.userId,
          channel: input.channel,
          eventType: input.eventType,
          dedupeKey: input.dedupeKey,
          status: "PENDING",
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return null;
      }
      throw error;
    }
  }

  private async markDispatchSent(dispatchId: string) {
    await this.prisma.notificationDispatch.update({
      where: { id: dispatchId },
      data: {
        status: NotificationDispatchStatus.SENT,
        sentAt: new Date(),
        failedAt: null,
        failureCode: null
      }
    });
  }

  private async markDispatchFailed(dispatchId: string, error: unknown) {
    await this.prisma.notificationDispatch.update({
      where: { id: dispatchId },
      data: {
        status: NotificationDispatchStatus.FAILED,
        failedAt: new Date(),
        failureCode: this.errorLabel(error)
      }
    });
    this.logger.warn(`Falha ao enviar notificacao por e-mail: ${this.errorLabel(error)}`);
  }

  private errorLabel(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private dayBucket(reference: Date) {
    return reference.toISOString().slice(0, 10);
  }

  private weekBucket(reference: Date) {
    const date = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  private formatMoney(value: number) {
    return value.toFixed(2);
  }
}
