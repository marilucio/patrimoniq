import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post
} from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { NetWorthService } from "./net-worth.service";

@Controller("net-worth")
export class NetWorthController {
  constructor(private readonly netWorthService: NetWorthService) {}

  @Get()
  getSnapshot(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.netWorthService.getSnapshot(auth);
  }

  @Get("snapshots")
  listSnapshots(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.netWorthService.listSnapshots(auth);
  }

  @Post("snapshots")
  createSnapshot(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body()
    body: {
      snapshotDate: string;
      totalAssets: number;
      totalLiabilities: number;
      liquidReserve?: number;
      investedAssets?: number;
    }
  ) {
    return this.netWorthService.createSnapshot(auth, body);
  }

  @Patch("snapshots/:id")
  updateSnapshot(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") snapshotId: string,
    @Body()
    body: {
      snapshotDate?: string;
      totalAssets?: number;
      totalLiabilities?: number;
      liquidReserve?: number;
      investedAssets?: number;
    }
  ) {
    return this.netWorthService.updateSnapshot(auth, snapshotId, body);
  }

  @Delete("snapshots/:id")
  deleteSnapshot(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") snapshotId: string
  ) {
    return this.netWorthService.deleteSnapshot(auth, snapshotId);
  }

  @Post("snapshots/generate-monthly")
  generateMonthlySnapshot(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.netWorthService.generateMonthlySnapshot(auth);
  }
}
