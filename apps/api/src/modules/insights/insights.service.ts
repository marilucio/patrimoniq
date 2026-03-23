import { Injectable } from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { DashboardService } from "../dashboard/dashboard.service";

@Injectable()
export class InsightsService {
  constructor(private readonly dashboardService: DashboardService) {}

  async getFeed(auth: AuthenticatedRequestContext) {
    const snapshot = await this.dashboardService.getOverview(auth);

    return {
      insights: snapshot.insights
    };
  }
}
