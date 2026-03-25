import { Controller, Get, Param, Post } from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AlertsService } from "./alerts.service";

@Controller("alerts")
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.alertsService.list(auth);
  }

  @Post("evaluate")
  evaluate(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.alertsService.evaluate(auth);
  }

  @Post(":id/acknowledge")
  acknowledge(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") id: string
  ) {
    return this.alertsService.acknowledge(auth, id);
  }

  @Post(":id/dismiss")
  dismiss(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") id: string
  ) {
    return this.alertsService.dismiss(auth, id);
  }

  @Post("acknowledge-all")
  acknowledgeAll(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.alertsService.acknowledgeAll(auth);
  }
}
