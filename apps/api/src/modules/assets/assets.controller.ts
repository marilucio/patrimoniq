import { AssetType } from "@prisma/client";
import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { AssetsService } from "./assets.service";

@Controller("assets")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.assetsService.list(auth);
  }

  @Post()
  create(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body()
    body: {
      linkedAccountId?: string;
      name: string;
      type: AssetType;
      currentValue: number;
      acquisitionValue?: number;
    }
  ) {
    return this.assetsService.create(auth, body);
  }

  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") id: string,
    @Body()
    body: {
      linkedAccountId?: string;
      name?: string;
      type?: AssetType;
      currentValue?: number;
      acquisitionValue?: number;
    }
  ) {
    return this.assetsService.update(auth, id, body);
  }

  @Delete(":id")
  archive(@CurrentAuth() auth: AuthenticatedRequestContext, @Param("id") id: string) {
    return this.assetsService.archive(auth, id);
  }
}
