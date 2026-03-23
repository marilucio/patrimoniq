import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { CategoryDirection, CostNature, Essentiality } from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { labelForCategoryDirection } from "../../common/finance.utils";
import { PrismaService } from "../../common/prisma.service";

interface CategoryInput {
  name: string;
  slug: string;
  direction: CategoryDirection;
  subcategories?: Array<{
    name: string;
    slug: string;
    costNature?: CostNature;
    essentiality?: Essentiality;
  }>;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(auth: AuthenticatedRequestContext) {
    const categories = await this.prisma.category.findMany({
      where: {
        userId: auth.userId,
        isActive: true
      },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" }
        }
      },
      orderBy: [{ direction: "asc" }, { name: "asc" }]
    });

    return {
      items: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        direction: labelForCategoryDirection(category.direction),
        directionCode: category.direction,
        subcategories: category.subcategories.map((subcategory) => ({
          id: subcategory.id,
          name: subcategory.name,
          slug: subcategory.slug,
          costNature: subcategory.costNature,
          essentiality: subcategory.essentiality
        }))
      }))
    };
  }

  async create(auth: AuthenticatedRequestContext, input: CategoryInput) {
    this.validate(input);

    return this.prisma.category.create({
      data: {
        userId: auth.userId,
        name: input.name.trim(),
        slug: input.slug.trim(),
        direction: input.direction,
        subcategories: input.subcategories?.length
          ? {
              create: input.subcategories.map((subcategory) => ({
                userId: auth.userId,
                name: subcategory.name.trim(),
                slug: subcategory.slug.trim(),
                costNature: subcategory.costNature ?? null,
                essentiality: subcategory.essentiality ?? null
              }))
            }
          : undefined
      },
      include: {
        subcategories: {
          where: { isActive: true }
        }
      }
    });
  }

  async update(
    auth: AuthenticatedRequestContext,
    categoryId: string,
    input: Partial<CategoryInput>
  ) {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        userId: auth.userId,
        isActive: true
      }
    });

    if (!category) {
      throw new NotFoundException("Categoria nao encontrada.");
    }

    return this.prisma.category.update({
      where: { id: category.id },
      data: {
        name: input.name?.trim() || category.name,
        slug: input.slug?.trim() || category.slug,
        direction: input.direction ?? category.direction
      },
      include: {
        subcategories: {
          where: { isActive: true }
        }
      }
    });
  }

  async archive(auth: AuthenticatedRequestContext, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        userId: auth.userId,
        isActive: true
      }
    });

    if (!category) {
      throw new NotFoundException("Categoria nao encontrada.");
    }

    await this.prisma.$transaction([
      this.prisma.subcategory.updateMany({
        where: { categoryId: category.id },
        data: { isActive: false }
      }),
      this.prisma.category.update({
        where: { id: category.id },
        data: { isActive: false }
      })
    ]);

    return { success: true };
  }

  private validate(input: CategoryInput) {
    if (!input.name?.trim()) {
      throw new BadRequestException("Nome da categoria obrigatorio.");
    }

    if (!input.slug?.trim()) {
      throw new BadRequestException("Slug da categoria obrigatorio.");
    }
  }
}
