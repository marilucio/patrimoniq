import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { NotificationService } from "../../common/notification.service";

@Injectable()
export class WeeklyDigestScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WeeklyDigestScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly notificationService: NotificationService) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.log("Resumo semanal automatico desativado por configuracao.");
      return;
    }
    const intervalMinutes = this.intervalMinutes();
    this.timer = setInterval(() => {
      void this.runTick();
    }, intervalMinutes * 60 * 1000);
    void this.runTick();
    this.logger.log(
      `Scheduler do resumo semanal ativo. Intervalo de verificacao: ${intervalMinutes} minuto(s).`
    );
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runTick() {
    const now = new Date();
    if (!this.shouldRunForWindow(now)) {
      return;
    }
    const result = await this.notificationService.sendWeeklyDigestBatch(now);
    if (result.sent > 0) {
      this.logger.log(
        `Resumo semanal enviado para ${result.sent} usuario(s). Tentativas elegiveis: ${result.attempted}.`
      );
    }
  }

  private isEnabled() {
    return (process.env.NOTIFICATIONS_WEEKLY_DIGEST_ENABLED ?? "true") !== "false";
  }

  private intervalMinutes() {
    const parsed = Number(process.env.NOTIFICATIONS_SCHEDULER_INTERVAL_MINUTES ?? 30);
    if (!Number.isFinite(parsed) || parsed <= 0) return 30;
    return parsed;
  }

  private targetUtcWeekDay() {
    const parsed = Number(process.env.NOTIFICATIONS_WEEKLY_DIGEST_DAY_UTC ?? 1);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 6) return 1;
    return parsed;
  }

  private targetUtcHour() {
    const parsed = Number(process.env.NOTIFICATIONS_WEEKLY_DIGEST_HOUR_UTC ?? 12);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 23) return 12;
    return parsed;
  }

  private shouldRunForWindow(now: Date) {
    return (
      now.getUTCDay() === this.targetUtcWeekDay() &&
      now.getUTCHours() === this.targetUtcHour()
    );
  }
}
