import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { FeedbackCategory } from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { EmailService } from "../../common/email.service";
import { feedbackSubmissionEmailTemplate } from "../../common/email.templates";
import { MonitoringService } from "../../common/monitoring.service";
import { PrismaService } from "../../common/prisma.service";
import { ProductAnalyticsService } from "../../common/product-analytics.service";

const feedbackCategoryLabels: Record<FeedbackCategory, string> = {
  BUG: "Bug",
  IDEA: "Ideia",
  ONBOARDING: "Onboarding",
  UX: "Experiencia",
  OTHER: "Outro"
};

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: ProductAnalyticsService,
    private readonly emailService: EmailService,
    private readonly monitoringService: MonitoringService
  ) {}

  async list(auth: AuthenticatedRequestContext, limit = 6) {
    let items: Awaited<ReturnType<typeof this.prisma.feedbackSubmission.findMany>>;

    try {
      items = await this.prisma.feedbackSubmission.findMany({
        where: {
          userId: auth.userId
        },
        orderBy: {
          createdAt: "desc"
        },
        take: Math.min(Math.max(limit, 1), 20)
      });
    } catch (error) {
      if (!this.shouldIgnoreFeedbackStorageError(error)) {
        throw error;
      }

      this.logger.warn(
        `Feedback indisponivel para listagem do usuario ${auth.userId}: ${this.describeError(error)}`
      );
      items = [];
    }

    return {
      items: items.map((item) => ({
        id: item.id,
        category: feedbackCategoryLabels[item.category],
        categoryCode: item.category,
        pagePath: item.pagePath,
        status: item.status === "NEW" ? "Novo" : item.status === "REVIEWED" ? "Revisado" : "Arquivado",
        statusCode: item.status,
        message: item.message,
        createdAt: item.createdAt.toISOString()
      }))
    };
  }

  async submit(
    auth: AuthenticatedRequestContext,
    input: {
      category?: FeedbackCategory;
      message: string;
      pagePath?: string;
      sentiment?: string;
    },
    context?: {
      userAgent?: string;
    }
  ) {
    if (!input.message?.trim() || input.message.trim().length < 8) {
      throw new BadRequestException("Descreva o feedback com pelo menos 8 caracteres.");
    }

    let feedback:
      | Awaited<ReturnType<typeof this.prisma.feedbackSubmission.create>>
      | { id: string; category: FeedbackCategory };

    try {
      feedback = await this.prisma.feedbackSubmission.create({
        data: {
          userId: auth.userId,
          category: input.category ?? "OTHER",
          message: input.message.trim(),
          pagePath: input.pagePath?.trim() || null,
          contactEmail: auth.email,
          userAgent: context?.userAgent ?? null,
          metadata: {
            fullName: auth.fullName,
            ...(input.sentiment ? { sentiment: input.sentiment } : {})
          }
        }
      });
    } catch (error) {
      if (!this.shouldIgnoreFeedbackStorageError(error)) {
        throw error;
      }

      this.logger.warn(
        `Feedback indisponivel para escrita do usuario ${auth.userId}: ${this.describeError(error)}`
      );
      feedback = {
        id: randomUUID(),
        category: input.category ?? "OTHER"
      };
    }

    await this.analytics.recordUserEvent({
      userId: auth.userId,
      sessionId: auth.sessionId,
      name: "FEEDBACK_SUBMITTED",
      pagePath: input.pagePath?.trim() || "/feedback",
      metadata: {
        category: feedback.category
      }
    });

    await Promise.allSettled([
      this.forwardToWebhook(feedback.id, auth, input),
      this.forwardByEmail(auth, input)
    ]);

    return {
      success: true,
      message: "Feedback enviado. Obrigado por ajudar a melhorar o Patrimoniq."
    };
  }

  private async forwardToWebhook(
    feedbackId: string,
    auth: AuthenticatedRequestContext,
    input: { category?: FeedbackCategory; message: string; pagePath?: string }
  ) {
    const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL?.trim();

    if (!webhookUrl) {
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = Number(process.env.FEEDBACK_WEBHOOK_TIMEOUT_MS ?? 3500);
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(process.env.FEEDBACK_WEBHOOK_TOKEN
              ? {
                  authorization: `Bearer ${process.env.FEEDBACK_WEBHOOK_TOKEN}`
                }
              : {})
          },
          body: JSON.stringify({
            app: "patrimoniq-web",
            feedbackId,
            userId: auth.userId,
            email: auth.email,
            fullName: auth.fullName,
            pagePath: input.pagePath ?? null,
            category: input.category ?? "OTHER",
            message: input.message.trim(),
            stage: process.env.APP_STAGE ?? process.env.NODE_ENV ?? "development",
            timestamp: new Date().toISOString()
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      this.logger.warn(
        `Falha ao encaminhar feedback para webhook: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async forwardByEmail(
    auth: AuthenticatedRequestContext,
    input: { category?: FeedbackCategory; message: string; pagePath?: string }
  ) {
    const feedbackEmail = process.env.FEEDBACK_EMAIL_TO?.trim();

    if (!feedbackEmail) {
      return;
    }

    try {
      const template = feedbackSubmissionEmailTemplate({
        fullName: auth.fullName,
        email: auth.email,
        category: feedbackCategoryLabels[input.category ?? "OTHER"],
        pagePath: input.pagePath ?? "nao informado",
        message: input.message.trim(),
        stage: process.env.APP_STAGE ?? process.env.NODE_ENV ?? "development"
      });

      await this.emailService.send({
        to: feedbackEmail,
        subject: template.subject,
        text: template.text,
        html: template.html
      });
    } catch (error) {
      void this.monitoringService.capture({
        level: "warning",
        title: "Falha ao encaminhar feedback por e-mail",
        message: error instanceof Error ? error.message : String(error),
        userId: auth.userId,
        path: input.pagePath ?? "/feedback",
        context: {
          feedbackEmail
        },
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  private shouldIgnoreFeedbackStorageError(error: unknown) {
    const code = this.readPrismaCode(error);
    const message = this.describeError(error);

    return code === "P2021" || code === "P2022" || /FeedbackSubmission/i.test(message);
  }

  private readPrismaCode(error: unknown) {
    if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
      return error.code;
    }

    return null;
  }

  private describeError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
