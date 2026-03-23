import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { LiabilityType } from "@prisma/client";
import { CurrentAuth } from "../../common/current-auth.decorator";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { LiabilitiesService } from "./liabilities.service";

@Controller("liabilities")
export class LiabilitiesController {
  constructor(private readonly liabilitiesService: LiabilitiesService) {}

  @Get()
  list(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.liabilitiesService.list(auth);
  }

  @Post()
  create(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body()
    body: {
      linkedCardId?: string;
      name: string;
      type: LiabilityType;
      currentBalance: number;
      monthlyPayment?: number;
    }
  ) {
    return this.liabilitiesService.create(auth, body);
  }

  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") id: string,
    @Body()
    body: {
      linkedCardId?: string;
      name?: string;
      type?: LiabilityType;
      currentBalance?: number;
      monthlyPayment?: number;
    }
  ) {
    return this.liabilitiesService.update(auth, id, body);
  }

  @Delete(":id")
  archive(@CurrentAuth() auth: AuthenticatedRequestContext, @Param("id") id: string) {
    return this.liabilitiesService.archive(auth, id);
  }
}
