import {
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { TransactionType } from "@prisma/client";
import { PrismaService } from "./prisma.service";

interface ScopedRefsInput {
  accountId?: string | null;
  counterpartyAccountId?: string | null;
  cardId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  goalId?: string | null;
  type?: TransactionType | null;
}

@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAccount(userId: string, accountId: string, label = "Conta") {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        userId,
        isArchived: false
      }
    });

    if (!account) {
      throw new NotFoundException(`${label} nao encontrada.`);
    }

    return account;
  }

  async assertCard(userId: string, cardId: string, label = "Cartao") {
    const card = await this.prisma.card.findFirst({
      where: {
        id: cardId,
        userId,
        isArchived: false
      }
    });

    if (!card) {
      throw new NotFoundException(`${label} nao encontrado.`);
    }

    return card;
  }

  async assertCategory(userId: string, categoryId: string, label = "Categoria") {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        userId,
        isActive: true
      }
    });

    if (!category) {
      throw new NotFoundException(`${label} nao encontrada.`);
    }

    return category;
  }

  async assertSubcategory(userId: string, subcategoryId: string, label = "Subcategoria") {
    const subcategory = await this.prisma.subcategory.findFirst({
      where: {
        id: subcategoryId,
        userId,
        isActive: true
      }
    });

    if (!subcategory) {
      throw new NotFoundException(`${label} nao encontrada.`);
    }

    return subcategory;
  }

  async assertGoal(userId: string, goalId: string, label = "Meta") {
    const goal = await this.prisma.goal.findFirst({
      where: {
        id: goalId,
        userId,
        status: {
          not: "CANCELED"
        }
      }
    });

    if (!goal) {
      throw new NotFoundException(`${label} nao encontrada.`);
    }

    return goal;
  }

  async resolveCategoryAndSubcategory(
    userId: string,
    input: { categoryId?: string | null; subcategoryId?: string | null }
  ) {
    let categoryId = input.categoryId ?? null;
    let subcategoryId = input.subcategoryId ?? null;

    if (subcategoryId) {
      const subcategory = await this.assertSubcategory(userId, subcategoryId);
      categoryId = categoryId ?? subcategory.categoryId;

      if (categoryId !== subcategory.categoryId) {
        throw new NotFoundException("Subcategoria nao pertence a categoria informada.");
      }
    }

    if (categoryId) {
      await this.assertCategory(userId, categoryId);
    }

    return {
      categoryId,
      subcategoryId
    };
  }

  async resolveTransactionRefs(userId: string, input: ScopedRefsInput) {
    const accountId = input.accountId
      ? (await this.assertAccount(userId, input.accountId)).id
      : null;
    const counterpartyAccountId = input.counterpartyAccountId
      ? (await this.assertAccount(userId, input.counterpartyAccountId, "Conta de destino")).id
      : null;
    const cardId = input.cardId ? (await this.assertCard(userId, input.cardId)).id : null;
    const categoryRefs = await this.resolveCategoryAndSubcategory(userId, {
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId
    });

    if (input.type === "TRANSFER" && !accountId) {
      throw new NotFoundException("Transferencias exigem uma conta de origem.");
    }

    return {
      accountId,
      counterpartyAccountId,
      cardId,
      categoryId: categoryRefs.categoryId,
      subcategoryId: categoryRefs.subcategoryId
    };
  }
}
