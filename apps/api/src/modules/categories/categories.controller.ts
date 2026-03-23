import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CategoryDirection, CostNature, Essentiality } from "@prisma/client";
import { CurrentAuth } from "../../common/current-auth.decorator";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { CategoriesService } from "./categories.service";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.categoriesService.list(auth);
  }

  @Post()
  create(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body()
    body: {
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
  ) {
    return this.categoriesService.create(auth, body);
  }

  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      slug?: string;
      direction?: CategoryDirection;
    }
  ) {
    return this.categoriesService.update(auth, id, body);
  }

  @Delete(":id")
  archive(@CurrentAuth() auth: AuthenticatedRequestContext, @Param("id") id: string) {
    return this.categoriesService.archive(auth, id);
  }
}
