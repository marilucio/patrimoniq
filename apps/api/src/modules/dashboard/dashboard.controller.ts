import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("overview")
  getOverview(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.dashboardService.getOverview(auth);
  }

  @Post("action-plan/:id/interaction")
  registerActionPlanInteraction(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") id: string,
    @Body() body?: { kind?: "open" | "done" | "dismiss"; route?: string }
  ) {
    return this.dashboardService.registerActionPlanInteraction(auth, id, body);
  }
}
