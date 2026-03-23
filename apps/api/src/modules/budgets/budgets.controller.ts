import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { BudgetCadence } from "@prisma/client";
import { CurrentAuth } from "../../common/current-auth.decorator";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { BudgetsService } from "./budgets.service";

@Controller("budgets")
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.budgetsService.list(auth);
  }

  @Post()
  create(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body()
    body: {
      categoryId?: string;
      subcategoryId?: string;
      name: string;
      cadence?: BudgetCadence;
      periodStart: string;
      periodEnd: string;
      amountLimit: number;
      alertThresholdPercent?: number;
      notes?: string;
    }
  ) {
    return this.budgetsService.create(auth, body);
  }

  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") id: string,
    @Body()
    body: {
      categoryId?: string;
      subcategoryId?: string;
      name?: string;
      cadence?: BudgetCadence;
      periodStart?: string;
      periodEnd?: string;
      amountLimit?: number;
      alertThresholdPercent?: number;
      notes?: string;
    }
  ) {
    return this.budgetsService.update(auth, id, body);
  }

  @Delete(":id")
  archive(@CurrentAuth() auth: AuthenticatedRequestContext, @Param("id") id: string) {
    return this.budgetsService.archive(auth, id);
  }
}
