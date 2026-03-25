import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("overview")
  getOverview(@CurrentAuth() auth: AuthenticatedRequestContext): Promise<Record<string, unknown>> {
    return this.dashboardService.getOverview(auth);
  }

  @Post("action-plan/:id/interaction")
  registerActionPlanInteraction(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") id: string,
    @Body() body?: { kind?: "open" | "done" | "dismiss" | "postpone"; route?: string; feedback?: string }
  ) {
    return this.dashboardService.registerActionPlanInteraction(auth, id, body);
  }

  @Post("action-plan/:id/status")
  updateActionPlanStatus(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") id: string,
    @Body()
    body?: {
      status?: "completed" | "postponed" | "dismissed";
      feedback?: string;
      postponeDays?: number;
    }
  ) {
    return this.dashboardService.updateActionPlanStatus(auth, id, body);
  }
}
