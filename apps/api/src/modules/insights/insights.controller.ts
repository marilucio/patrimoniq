import { Controller, Get } from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { InsightsService } from "./insights.service";

@Controller("insights")
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  getFeed(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.insightsService.getFeed(auth);
  }
}
