import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";

@Injectable()
export class EngagementAnalyticsService {
  private readonly logger = new Logger(EngagementAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    userId: string;
    sessionId?: string | null;
    source: string;
    eventName: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.engagementMetric.create({
        data: {
          userId: input.userId,
          sessionId: input.sessionId ?? null,
          source: input.source,
          eventName: input.eventName,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao registrar metrica ${input.source}:${input.eventName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
