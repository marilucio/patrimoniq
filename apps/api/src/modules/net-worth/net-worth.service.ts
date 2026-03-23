import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { labelForEnum, monthLabel, toNumber } from "../../common/finance.utils";
import { NetWorthSnapshotsService } from "../../common/net-worth-snapshots.service";
import { PrismaService } from "../../common/prisma.service";

interface SnapshotInput {
  snapshotDate: string;
  totalAssets: number;
  totalLiabilities: number;
  liquidReserve?: number;
  investedAssets?: number;
}

@Injectable()
export class NetWorthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotsService: NetWorthSnapshotsService
  ) {}

  async getSnapshot(auth: AuthenticatedRequestContext) {
    const [assets, liabilities, snapshots] = await Promise.all([
      this.prisma.asset.findMany({
        where: { userId: auth.userId, isArchived: false },
        orderBy: [{ type: "asc" }, { name: "asc" }]
      }),
      this.prisma.liability.findMany({
        where: { userId: auth.userId, isArchived: false },
        orderBy: [{ type: "asc" }, { name: "asc" }]
      }),
      this.prisma.netWorthSnapshot.findMany({
        where: { userId: auth.userId },
        orderBy: { snapshotDate: "asc" },
        take: 24
      })
    ]);

    const totals = await this.snapshotsService.calculateTotals(auth.userId);
    const currentMonth = new Date();
    const currentPoint = {
      month: monthLabel(currentMonth),
      netWorth: totals.netWorth
    };
    const timeline = snapshots.map((snapshot) => ({
      month: monthLabel(snapshot.snapshotDate),
      netWorth: toNumber(snapshot.netWorth)
    }));
    const currentIndex = timeline.findIndex((item) => item.month === currentPoint.month);

    if (currentIndex >= 0) {
      timeline[currentIndex] = currentPoint;
    } else {
      timeline.push(currentPoint);
    }

    return {
      assets: assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        type: labelForEnum(asset.type),
        typeCode: asset.type,
        value: toNumber(asset.currentValue)
      })),
      liabilities: liabilities.map((liability) => ({
        id: liability.id,
        name: liability.name,
        type: labelForEnum(liability.type),
        typeCode: liability.type,
        balance: toNumber(liability.currentBalance),
        monthlyCost: toNumber(liability.monthlyPayment)
      })),
      netWorth: totals.netWorth,
      timeline
    };
  }

  async listSnapshots(auth: AuthenticatedRequestContext) {
    const snapshots = await this.prisma.netWorthSnapshot.findMany({
      where: { userId: auth.userId },
      orderBy: { snapshotDate: "desc" }
    });

    return {
      items: snapshots.map((snapshot) => ({
        id: snapshot.id,
        snapshotDate: snapshot.snapshotDate.toISOString().slice(0, 10),
        totalAssets: toNumber(snapshot.totalAssets),
        totalLiabilities: toNumber(snapshot.totalLiabilities),
        netWorth: toNumber(snapshot.netWorth),
        liquidReserve: toNumber(snapshot.liquidReserve),
        investedAssets: toNumber(snapshot.investedAssets)
      }))
    };
  }

  async createSnapshot(auth: AuthenticatedRequestContext, input: SnapshotInput) {
    this.validateSnapshotInput(input);
    const snapshotDate = new Date(input.snapshotDate);
    const existing = await this.prisma.netWorthSnapshot.findUnique({
      where: {
        userId_snapshotDate: {
          userId: auth.userId,
          snapshotDate
        }
      }
    });

    if (existing) {
      throw new ConflictException("Ja existe snapshot para esta data.");
    }

    return this.prisma.netWorthSnapshot.create({
      data: this.toSnapshotData(auth.userId, input)
    });
  }

  async updateSnapshot(
    auth: AuthenticatedRequestContext,
    snapshotId: string,
    input: Partial<SnapshotInput>
  ) {
    const snapshot = await this.prisma.netWorthSnapshot.findFirst({
      where: {
        id: snapshotId,
        userId: auth.userId
      }
    });

    if (!snapshot) {
      throw new NotFoundException("Snapshot nao encontrado.");
    }

    const nextTotalAssets =
      input.totalAssets !== undefined ? input.totalAssets : toNumber(snapshot.totalAssets);
    const nextTotalLiabilities =
      input.totalLiabilities !== undefined
        ? input.totalLiabilities
        : toNumber(snapshot.totalLiabilities);
    const snapshotDate = input.snapshotDate ? new Date(input.snapshotDate) : snapshot.snapshotDate;

    return this.prisma.netWorthSnapshot.update({
      where: { id: snapshot.id },
      data: {
        snapshotDate,
        totalAssets: new Prisma.Decimal(nextTotalAssets),
        totalLiabilities: new Prisma.Decimal(nextTotalLiabilities),
        netWorth: new Prisma.Decimal(nextTotalAssets - nextTotalLiabilities),
        liquidReserve:
          input.liquidReserve !== undefined
            ? new Prisma.Decimal(input.liquidReserve)
            : snapshot.liquidReserve,
        investedAssets:
          input.investedAssets !== undefined
            ? new Prisma.Decimal(input.investedAssets)
            : snapshot.investedAssets
      }
    });
  }

  async deleteSnapshot(auth: AuthenticatedRequestContext, snapshotId: string) {
    const snapshot = await this.prisma.netWorthSnapshot.findFirst({
      where: {
        id: snapshotId,
        userId: auth.userId
      }
    });

    if (!snapshot) {
      throw new NotFoundException("Snapshot nao encontrado.");
    }

    await this.prisma.netWorthSnapshot.delete({
      where: { id: snapshot.id }
    });

    return { success: true };
  }

  async generateMonthlySnapshot(auth: AuthenticatedRequestContext) {
    const snapshot = await this.snapshotsService.upsertMonthlySnapshot(auth.userId);

    return {
      id: snapshot.id,
      snapshotDate: snapshot.snapshotDate.toISOString().slice(0, 10),
      generated: true
    };
  }

  private validateSnapshotInput(input: SnapshotInput) {
    if (!input.snapshotDate) {
      throw new BadRequestException("Data do snapshot obrigatoria.");
    }

    if (Number.isNaN(input.totalAssets) || Number.isNaN(input.totalLiabilities)) {
      throw new BadRequestException("Totais patrimoniais invalidos.");
    }
  }

  private toSnapshotData(userId: string, input: SnapshotInput) {
    const netWorth = input.totalAssets - input.totalLiabilities;

    return {
      userId,
      snapshotDate: new Date(input.snapshotDate),
      totalAssets: new Prisma.Decimal(input.totalAssets),
      totalLiabilities: new Prisma.Decimal(input.totalLiabilities),
      netWorth: new Prisma.Decimal(netWorth),
      liquidReserve: new Prisma.Decimal(input.liquidReserve ?? 0),
      investedAssets: new Prisma.Decimal(input.investedAssets ?? 0)
    };
  }
}
