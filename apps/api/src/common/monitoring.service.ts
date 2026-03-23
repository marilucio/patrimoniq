import { Injectable, Logger } from "@nestjs/common";

interface MonitoringEvent {
  level: "warning" | "error";
  title: string;
  message: string;
  requestId?: string;
  userId?: string;
  path?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
  stack?: string;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  getStatus() {
    const provider = (process.env.MONITORING_PROVIDER ?? "none").trim().toLowerCase();
    const webhookUrl = process.env.MONITORING_WEBHOOK_URL?.trim();
    const enabled = provider === "webhook" && Boolean(webhookUrl);

    return {
      provider: enabled ? "webhook" : "none",
      enabled,
      targetLabel: enabled ? "Webhook externo configurado" : "Somente logs locais"
    };
  }

  async capture(event: MonitoringEvent) {
    const status = this.getStatus();

    if (!status.enabled) {
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = Number(process.env.MONITORING_WEBHOOK_TIMEOUT_MS ?? 3500);
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        await fetch(process.env.MONITORING_WEBHOOK_URL!, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(process.env.MONITORING_WEBHOOK_TOKEN
              ? {
                  authorization: `Bearer ${process.env.MONITORING_WEBHOOK_TOKEN}`
                }
              : {})
          },
          body: JSON.stringify({
            app: "patrimoniq-api",
            environment: process.env.APP_STAGE ?? process.env.NODE_ENV ?? "development",
            timestamp: new Date().toISOString(),
            ...event
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      this.logger.warn(
        `Falha ao enviar evento para o monitoramento externo: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
