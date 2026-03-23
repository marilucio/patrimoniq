import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { startOfMonth, toNumber } from "./finance.utils";
import { PrismaService } from "./prisma.service";

@Injectable()
export class NetWorthSnapshotsService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateTotals(userId: string) {
    const [assets, liabilities] = await Promise.all([
      this.prisma.asset.findMany({
        where: {
          userId,
          isArchived: false,
          includeInNetWorth: true
        }
      }),
      this.prisma.liability.findMany({
        where: {
          userId,
          isArchived: false,
          includeInNetWorth: true
        }
      })
    ]);

    const totalAssets = assets.reduce((sum, item) => sum + toNumber(item.currentValue), 0);
    const totalLiabilities = liabilities.reduce(
      (sum, item) => sum + toNumber(item.currentBalance),
      0
    );
    const netWorth = totalAssets - totalLiabilities;
    const liquidReserve = assets
      .filter((item) => item.type === "CASH" || item.name.toLowerCase().includes("reserva"))
      .reduce((sum, item) => sum + toNumber(item.currentValue), 0);
    const investedAssets = assets
      .filter((item) => item.type === "INVESTMENT")
      .reduce((sum, item) => sum + toNumber(item.currentValue), 0);

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      liquidReserve,
      investedAssets
    };
  }

  async upsertMonthlySnapshot(userId: string, referenceDate = new Date()) {
    const snapshotDate = startOfMonth(referenceDate);
    const totals = await this.calculateTotals(userId);

    return this.prisma.netWorthSnapshot.upsert({
      where: {
        userId_snapshotDate: {
          userId,
          snapshotDate
        }
      },
      update: {
        totalAssets: new Prisma.Decimal(totals.totalAssets),
        totalLiabilities: new Prisma.Decimal(totals.totalLiabilities),
        netWorth: new Prisma.Decimal(totals.netWorth),
        liquidReserve: new Prisma.Decimal(totals.liquidReserve),
        investedAssets: new Prisma.Decimal(totals.investedAssets)
      },
      create: {
        userId,
        snapshotDate,
        totalAssets: new Prisma.Decimal(totals.totalAssets),
        totalLiabilities: new Prisma.Decimal(totals.totalLiabilities),
        netWorth: new Prisma.Decimal(totals.netWorth),
        liquidReserve: new Prisma.Decimal(totals.liquidReserve),
        investedAssets: new Prisma.Decimal(totals.investedAssets)
      }
    });
  }
}
