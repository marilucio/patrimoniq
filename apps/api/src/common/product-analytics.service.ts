import { Injectable, Logger } from "@nestjs/common";
import { Prisma, ProductEventName } from "@prisma/client";
import { PrismaService } from "./prisma.service";

const eventLabels: Record<ProductEventName, string> = {
  REGISTER_COMPLETED: "Cadastro concluido",
  LOGIN_COMPLETED: "Login realizado",
  PASSWORD_RESET_REQUESTED: "Recuperacao de senha solicitada",
  DASHBOARD_FIRST_VIEWED: "Primeira visualizacao da visao geral",
  FIRST_ACCOUNT_CREATED: "Primeira conta criada",
  FIRST_INCOME_CREATED: "Primeira receita criada",
  FIRST_EXPENSE_CREATED: "Primeira despesa criada",
  FIRST_GOAL_CREATED: "Primeira meta criada",
  ONBOARDING_COMPLETED: "Onboarding concluido",
  ONBOARDING_STALLED: "Onboarding interrompido",
  PROFILE_UPDATED: "Perfil atualizado",
  PASSWORD_CHANGED: "Senha alterada",
  SESSIONS_REVOKED: "Sessoes encerradas",
  PREFERENCES_CHANGED: "Preferencias alteradas",
  FEEDBACK_SUBMITTED: "Feedback enviado",
};

const orderedEvents: ProductEventName[] = [
  "REGISTER_COMPLETED",
  "LOGIN_COMPLETED",
  "PASSWORD_RESET_REQUESTED",
  "DASHBOARD_FIRST_VIEWED",
  "FIRST_ACCOUNT_CREATED",
  "FIRST_INCOME_CREATED",
  "FIRST_EXPENSE_CREATED",
  "FIRST_GOAL_CREATED",
  "ONBOARDING_COMPLETED",
  "ONBOARDING_STALLED",
  "PROFILE_UPDATED",
  "PASSWORD_CHANGED",
  "SESSIONS_REVOKED",
  "PREFERENCES_CHANGED",
  "FEEDBACK_SUBMITTED",
];

@Injectable()
export class ProductAnalyticsService {
  private readonly logger = new Logger(ProductAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  labelFor(name: ProductEventName) {
    return eventLabels[name];
  }

  onboardingStaleHours() {
    const hours = Number(process.env.ONBOARDING_STALE_HOURS ?? 24);
    return Number.isFinite(hours) && hours > 0 ? hours : 24;
  }

  async record(input: {
    userId?: string | null;
    sessionId?: string | null;
    name: ProductEventName;
    pagePath?: string | null;
    dedupeKey?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    return this.runWriteSafely(`record:${input.name}`, async () => {
      if (input.dedupeKey) {
        return this.prisma.productEvent.upsert({
          where: {
            dedupeKey: input.dedupeKey,
          },
          update: {},
          create: {
            userId: input.userId ?? null,
            sessionId: input.sessionId ?? null,
            name: input.name,
            pagePath: input.pagePath ?? null,
            dedupeKey: input.dedupeKey,
            metadata: this.toJson(input.metadata),
          },
        });
      }

      return this.prisma.productEvent.create({
        data: {
          userId: input.userId ?? null,
          sessionId: input.sessionId ?? null,
          name: input.name,
          pagePath: input.pagePath ?? null,
          metadata: this.toJson(input.metadata),
        },
      });
    });
  }

  async recordUserEvent(input: {
    userId: string;
    sessionId?: string | null;
    name: ProductEventName;
    pagePath?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    return this.record(input);
  }

  async recordOnceForUser(input: {
    userId: string;
    sessionId?: string | null;
    name: ProductEventName;
    pagePath?: string | null;
    dedupeScope?: string;
    metadata?: Record<string, unknown> | null;
  }) {
    const dedupeKey = `${input.userId}:${input.name}:${input.dedupeScope ?? "global"}`;

    return this.record({
      ...input,
      dedupeKey,
    });
  }

  async getSummary(userId: string) {
    try {
      const [grouped, recent] = await Promise.all([
        this.prisma.productEvent.groupBy({
          by: ["name"],
          where: {
            userId,
          },
          _count: {
            _all: true,
          },
          _max: {
            occurredAt: true,
          },
        }),
        this.prisma.productEvent.findMany({
          where: {
            userId,
          },
          orderBy: {
            occurredAt: "desc",
          },
          take: 12,
        }),
      ]);

      const counts = new Map(
        grouped.map((item) => [
          item.name,
          {
            count: item._count._all,
            lastOccurredAt: item._max.occurredAt?.toISOString() ?? null,
          },
        ]),
      );

      const stalledEvent = recent.find(
        (event) => event.name === "ONBOARDING_STALLED",
      );
      const stalledMetadata =
        stalledEvent?.metadata && typeof stalledEvent.metadata === "object"
          ? stalledEvent.metadata
          : null;

      return {
        events: orderedEvents.map((name) => ({
          name,
          label: this.labelFor(name),
          count: counts.get(name)?.count ?? 0,
          lastOccurredAt: counts.get(name)?.lastOccurredAt ?? null,
        })),
        recentEvents: recent.map((event) => ({
          id: event.id,
          name: event.name,
          label: this.labelFor(event.name),
          pagePath: event.pagePath,
          occurredAt: event.occurredAt.toISOString(),
          metadata: event.metadata,
        })),
        onboarding: {
          isStalled: Boolean(stalledEvent),
          stalledAt: stalledEvent?.occurredAt.toISOString() ?? null,
          remainingSteps:
            stalledMetadata &&
            "remainingSteps" in stalledMetadata &&
            Array.isArray(stalledMetadata.remainingSteps)
              ? stalledMetadata.remainingSteps.filter(
                  (item): item is string => typeof item === "string",
                )
              : [],
        },
      };
    } catch (error) {
      if (!this.shouldIgnoreAnalyticsError(error)) {
        throw error;
      }

      this.logger.warn(
        `Analytics indisponivel para resumo do usuario ${userId}: ${this.describeError(error)}`,
      );
      return this.emptySummary();
    }
  }

  private toJson(value?: Record<string, unknown> | null) {
    return value ? (value as Prisma.InputJsonValue) : undefined;
  }

  private emptySummary() {
    return {
      events: orderedEvents.map((name) => ({
        name,
        label: this.labelFor(name),
        count: 0,
        lastOccurredAt: null,
      })),
      recentEvents: [],
      onboarding: {
        isStalled: false,
        stalledAt: null,
        remainingSteps: [],
      },
    };
  }

  private async runWriteSafely<T>(operation: string, action: () => Promise<T>) {
    try {
      return await action();
    } catch (error) {
      if (!this.shouldIgnoreAnalyticsError(error)) {
        throw error;
      }

      this.logger.warn(
        `Analytics indisponivel em ${operation}: ${this.describeError(error)}`,
      );
      return null;
    }
  }

  private shouldIgnoreAnalyticsError(error: unknown) {
    const code = this.readPrismaCode(error);
    const message = this.describeError(error);

    return (
      code === "P2021" ||
      code === "P2022" ||
      /ProductEvent|ProductEventName|productEvent/i.test(message)
    );
  }

  private readPrismaCode(error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string"
    ) {
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
