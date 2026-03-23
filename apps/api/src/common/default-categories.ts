import { defaultCategoryCatalog } from "@patrimoniq/domain";
import {
  CategoryDirection,
  CostNature,
  Essentiality,
  Prisma,
  PrismaClient
} from "@prisma/client";

type PrismaLike = Prisma.TransactionClient | PrismaClient;

function mapDirection(direction: "expense" | "income" | "saving" | "debt"): CategoryDirection {
  switch (direction) {
    case "income":
      return "INCOME";
    case "saving":
      return "SAVING";
    case "debt":
      return "DEBT";
    default:
      return "EXPENSE";
  }
}

function mapCostNature(value?: "fixed" | "variable" | "extraordinary"): CostNature | null {
  if (!value) {
    return null;
  }

  switch (value) {
    case "fixed":
      return "FIXED";
    case "extraordinary":
      return "EXTRAORDINARY";
    default:
      return "VARIABLE";
  }
}

function mapEssentiality(
  value?: "essential" | "important" | "superfluous" | "impulse"
): Essentiality | null {
  if (!value) {
    return null;
  }

  switch (value) {
    case "essential":
      return "ESSENTIAL";
    case "superfluous":
      return "SUPERFLUOUS";
    case "impulse":
      return "IMPULSE";
    default:
      return "IMPORTANT";
  }
}

export async function seedDefaultCategories(prisma: PrismaLike, userId: string) {
  for (const [categoryIndex, category] of defaultCategoryCatalog.entries()) {
    const createdCategory = await prisma.category.upsert({
      where: {
        userId_slug: {
          userId,
          slug: category.slug
        }
      },
      update: {
        name: category.name,
        direction: mapDirection(category.direction),
        sortOrder: categoryIndex,
        isSystem: true,
        isActive: true
      },
      create: {
        userId,
        name: category.name,
        slug: category.slug,
        direction: mapDirection(category.direction),
        sortOrder: categoryIndex,
        isSystem: true
      }
    });

    for (const [subcategoryIndex, subcategory] of category.subcategories.entries()) {
      await prisma.subcategory.upsert({
        where: {
          categoryId_slug: {
            categoryId: createdCategory.id,
            slug: subcategory.slug
          }
        },
        update: {
          userId,
          name: subcategory.name,
          costNature: mapCostNature(subcategory.nature),
          essentiality: mapEssentiality(subcategory.essentiality),
          sortOrder: subcategoryIndex,
          isSystem: true,
          isActive: true
        },
        create: {
          userId,
          categoryId: createdCategory.id,
          name: subcategory.name,
          slug: subcategory.slug,
          costNature: mapCostNature(subcategory.nature),
          essentiality: mapEssentiality(subcategory.essentiality),
          sortOrder: subcategoryIndex,
          isSystem: true
        }
      });
    }
  }
}
