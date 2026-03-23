import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { GoalKind, GoalPriority } from "@prisma/client";
import { CurrentAuth } from "../../common/current-auth.decorator";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { GoalsService } from "./goals.service";

@Controller("goals")
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.goalsService.list(auth);
  }

  @Post()
  create(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body()
    body: {
      name: string;
      kind: GoalKind;
      priority: GoalPriority;
      targetAmount: number;
      currentAmount?: number;
      monthlyContributionTarget?: number;
      targetDate?: string;
      notes?: string;
    }
  ) {
    return this.goalsService.create(auth, body);
  }

  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      kind?: GoalKind;
      priority?: GoalPriority;
      targetAmount?: number;
      currentAmount?: number;
      monthlyContributionTarget?: number;
      targetDate?: string;
      notes?: string;
    }
  ) {
    return this.goalsService.update(auth, id, body);
  }

  @Delete(":id")
  cancel(@CurrentAuth() auth: AuthenticatedRequestContext, @Param("id") id: string) {
    return this.goalsService.cancel(auth, id);
  }
}
