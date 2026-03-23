import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { LiabilityType, Prisma } from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { labelForEnum, toNumber } from "../../common/finance.utils";
import { NetWorthSnapshotsService } from "../../common/net-worth-snapshots.service";
import { OwnershipService } from "../../common/ownership.service";
import { PrismaService } from "../../common/prisma.service";

interface LiabilityInput {
  linkedCardId?: string;
  name: string;
  type: LiabilityType;
  currentBalance: number;
  monthlyPayment?: number;
}

@Injectable()
export class LiabilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private readonly snapshotsService: NetWorthSnapshotsService
  ) {}

  async list(auth: AuthenticatedRequestContext) {
    const liabilities = await this.prisma.liability.findMany({
      where: { userId: auth.userId, isArchived: false },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    });

    return {
      items: liabilities.map((liability) => ({
        id: liability.id,
        name: liability.name,
        type: labelForEnum(liability.type),
        typeCode: liability.type,
        balance: toNumber(liability.currentBalance),
        currentBalance: toNumber(liability.currentBalance),
        monthlyCost: toNumber(liability.monthlyPayment),
        monthlyPayment: toNumber(liability.monthlyPayment),
        linkedCardId: liability.linkedCardId
      }))
    };
  }

  async create(auth: AuthenticatedRequestContext, input: LiabilityInput) {
    this.validate(input);
    const linkedCardId = await this.resolveLinkedCardId(auth.userId, input.linkedCardId);

    const created = await this.prisma.liability.create({
      data: {
        userId: auth.userId,
        linkedCardId,
        name: input.name.trim(),
        type: input.type,
        currentBalance: new Prisma.Decimal(input.currentBalance),
        monthlyPayment:
          input.monthlyPayment !== undefined
            ? new Prisma.Decimal(input.monthlyPayment)
            : null
      }
    });

    await this.snapshotsService.upsertMonthlySnapshot(auth.userId);
    return created;
  }

  async update(
    auth: AuthenticatedRequestContext,
    liabilityId: string,
    input: Partial<LiabilityInput>
  ) {
    const liability = await this.prisma.liability.findFirst({
      where: { id: liabilityId, userId: auth.userId, isArchived: false }
    });

    if (!liability) {
      throw new NotFoundException("Passivo nao encontrado.");
    }

    const linkedCardId = await this.resolveLinkedCardId(
      auth.userId,
      input.linkedCardId !== undefined ? input.linkedCardId || null : liability.linkedCardId
    );

    const updated = await this.prisma.liability.update({
      where: { id: liability.id },
      data: {
        linkedCardId,
        name: input.name?.trim() || liability.name,
        type: input.type ?? liability.type,
        currentBalance:
          input.currentBalance !== undefined
            ? new Prisma.Decimal(input.currentBalance)
            : liability.currentBalance,
        monthlyPayment:
          input.monthlyPayment !== undefined
            ? new Prisma.Decimal(input.monthlyPayment)
            : liability.monthlyPayment
      }
    });

    await this.snapshotsService.upsertMonthlySnapshot(auth.userId);
    return updated;
  }

  async archive(auth: AuthenticatedRequestContext, liabilityId: string) {
    const liability = await this.prisma.liability.findFirst({
      where: { id: liabilityId, userId: auth.userId, isArchived: false }
    });

    if (!liability) {
      throw new NotFoundException("Passivo nao encontrado.");
    }

    await this.prisma.liability.update({
      where: { id: liability.id },
      data: { isArchived: true }
    });

    await this.snapshotsService.upsertMonthlySnapshot(auth.userId);
    return { success: true };
  }

  private validate(input: LiabilityInput) {
    if (!input.name?.trim()) {
      throw new BadRequestException("Nome do passivo obrigatorio.");
    }

    if (input.currentBalance === undefined || Number.isNaN(input.currentBalance)) {
      throw new BadRequestException("Saldo atual do passivo obrigatorio.");
    }
  }

  private async resolveLinkedCardId(userId: string, linkedCardId?: string | null) {
    if (!linkedCardId) {
      return null;
    }

    await this.ownership.assertCard(userId, linkedCardId, "Cartao vinculado");
    return linkedCardId;
  }
}
