import { Controller, Get } from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.reportsService.list(auth);
  }
}
