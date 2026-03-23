import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AssetType, Prisma } from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { labelForEnum, toNumber } from "../../common/finance.utils";
import { NetWorthSnapshotsService } from "../../common/net-worth-snapshots.service";
import { OwnershipService } from "../../common/ownership.service";
import { PrismaService } from "../../common/prisma.service";

interface AssetInput {
  linkedAccountId?: string;
  name: string;
  type: AssetType;
  currentValue: number;
  acquisitionValue?: number;
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private readonly snapshotsService: NetWorthSnapshotsService
  ) {}

  async list(auth: AuthenticatedRequestContext) {
    const assets = await this.prisma.asset.findMany({
      where: { userId: auth.userId, isArchived: false },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    });

    return {
      items: assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        type: labelForEnum(asset.type),
        typeCode: asset.type,
        value: toNumber(asset.currentValue),
        currentValue: toNumber(asset.currentValue),
        acquisitionValue: toNumber(asset.acquisitionValue),
        linkedAccountId: asset.linkedAccountId
      }))
    };
  }

  async create(auth: AuthenticatedRequestContext, input: AssetInput) {
    this.validate(input);
    const linkedAccountId = await this.resolveLinkedAccountId(auth.userId, input.linkedAccountId);

    const created = await this.prisma.asset.create({
      data: {
        userId: auth.userId,
        linkedAccountId,
        name: input.name.trim(),
        type: input.type,
        currentValue: new Prisma.Decimal(input.currentValue),
        acquisitionValue:
          input.acquisitionValue !== undefined
            ? new Prisma.Decimal(input.acquisitionValue)
            : null
      }
    });

    await this.snapshotsService.upsertMonthlySnapshot(auth.userId);
    return created;
  }

  async update(
    auth: AuthenticatedRequestContext,
    assetId: string,
    input: Partial<AssetInput>
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, userId: auth.userId, isArchived: false }
    });

    if (!asset) {
      throw new NotFoundException("Ativo nao encontrado.");
    }

    const linkedAccountId = await this.resolveLinkedAccountId(
      auth.userId,
      input.linkedAccountId !== undefined ? input.linkedAccountId || null : asset.linkedAccountId
    );

    const updated = await this.prisma.asset.update({
      where: { id: asset.id },
      data: {
        linkedAccountId,
        name: input.name?.trim() || asset.name,
        type: input.type ?? asset.type,
        currentValue:
          input.currentValue !== undefined
            ? new Prisma.Decimal(input.currentValue)
            : asset.currentValue,
        acquisitionValue:
          input.acquisitionValue !== undefined
            ? new Prisma.Decimal(input.acquisitionValue)
            : asset.acquisitionValue
      }
    });

    await this.snapshotsService.upsertMonthlySnapshot(auth.userId);
    return updated;
  }

  async archive(auth: AuthenticatedRequestContext, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, userId: auth.userId, isArchived: false }
    });

    if (!asset) {
      throw new NotFoundException("Ativo nao encontrado.");
    }

    await this.prisma.asset.update({
      where: { id: asset.id },
      data: { isArchived: true }
    });

    await this.snapshotsService.upsertMonthlySnapshot(auth.userId);
    return { success: true };
  }

  private validate(input: AssetInput) {
    if (!input.name?.trim()) {
      throw new BadRequestException("Nome do ativo obrigatorio.");
    }

    if (input.currentValue === undefined || Number.isNaN(input.currentValue)) {
      throw new BadRequestException("Valor atual do ativo obrigatorio.");
    }
  }

  private async resolveLinkedAccountId(userId: string, linkedAccountId?: string | null) {
    if (!linkedAccountId) {
      return null;
    }

    await this.ownership.assertAccount(userId, linkedAccountId, "Conta vinculada");
    return linkedAccountId;
  }
}
