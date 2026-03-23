import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { CostNature, Essentiality } from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { OwnershipService } from "../../common/ownership.service";
import { PrismaService } from "../../common/prisma.service";

interface SubcategoryInput {
  categoryId: string;
  name: string;
  slug: string;
  costNature?: CostNature;
  essentiality?: Essentiality;
}

@Injectable()
export class SubcategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService
  ) {}

  async list(
    auth: AuthenticatedRequestContext,
    input?: { categoryId?: string; search?: string }
  ) {
    const items = await this.prisma.subcategory.findMany({
      where: {
        userId: auth.userId,
        isActive: true,
        categoryId: input?.categoryId || undefined,
        name: input?.search
          ? {
              contains: input.search,
              mode: "insensitive"
            }
          : undefined
      },
      include: {
        category: true
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }]
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        categoryName: item.category.name,
        name: item.name,
        slug: item.slug,
        costNature: item.costNature,
        essentiality: item.essentiality
      }))
    };
  }

  async create(auth: AuthenticatedRequestContext, input: SubcategoryInput) {
    this.validate(input);
    await this.ownership.assertCategory(auth.userId, input.categoryId);

    return this.prisma.subcategory.create({
      data: {
        userId: auth.userId,
        categoryId: input.categoryId,
        name: input.name.trim(),
        slug: input.slug.trim(),
        costNature: input.costNature ?? null,
        essentiality: input.essentiality ?? null
      }
    });
  }

  async update(
    auth: AuthenticatedRequestContext,
    subcategoryId: string,
    input: Partial<SubcategoryInput>
  ) {
    const subcategory = await this.prisma.subcategory.findFirst({
      where: {
        id: subcategoryId,
        userId: auth.userId,
        isActive: true
      }
    });

    if (!subcategory) {
      throw new NotFoundException("Subcategoria nao encontrada.");
    }

    const categoryId = input.categoryId ?? subcategory.categoryId;
    await this.ownership.assertCategory(auth.userId, categoryId);

    return this.prisma.subcategory.update({
      where: { id: subcategory.id },
      data: {
        categoryId,
        name: input.name?.trim() || subcategory.name,
        slug: input.slug?.trim() || subcategory.slug,
        costNature:
          input.costNature !== undefined ? input.costNature || null : subcategory.costNature,
        essentiality:
          input.essentiality !== undefined
            ? input.essentiality || null
            : subcategory.essentiality
      }
    });
  }

  async archive(auth: AuthenticatedRequestContext, subcategoryId: string) {
    const subcategory = await this.prisma.subcategory.findFirst({
      where: {
        id: subcategoryId,
        userId: auth.userId,
        isActive: true
      }
    });

    if (!subcategory) {
      throw new NotFoundException("Subcategoria nao encontrada.");
    }

    await this.prisma.subcategory.update({
      where: { id: subcategory.id },
      data: {
        isActive: false
      }
    });

    return { success: true };
  }

  private validate(input: SubcategoryInput) {
    if (!input.categoryId) {
      throw new BadRequestException("Categoria obrigatoria para a subcategoria.");
    }

    if (!input.name?.trim()) {
      throw new BadRequestException("Nome da subcategoria obrigatorio.");
    }

    if (!input.slug?.trim()) {
      throw new BadRequestException("Slug da subcategoria obrigatorio.");
    }
  }
}
