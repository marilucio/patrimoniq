import { Module } from "@nestjs/common";
import { AlertsController } from "./alerts.controller";
import { AlertsService } from "./alerts.service";
import { WeeklyDigestScheduler } from "./weekly-digest.scheduler";

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, WeeklyDigestScheduler],
  exports: [AlertsService]
})
export class AlertsModule {}
