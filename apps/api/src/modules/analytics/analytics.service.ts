import { Injectable } from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { ProductAnalyticsService } from "../../common/product-analytics.service";

@Injectable()
export class AnalyticsService {
  constructor(private readonly analytics: ProductAnalyticsService) {}

  getSummary(auth: AuthenticatedRequestContext) {
    return this.analytics.getSummary(auth.userId);
  }
}
