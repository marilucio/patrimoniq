import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CostNature, Essentiality } from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { SubcategoriesService } from "./subcategories.service";

@Controller("subcategories")
export class SubcategoriesController {
  constructor(private readonly subcategoriesService: SubcategoriesService) {}

  @Get()
  list(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Query("categoryId") categoryId?: string,
    @Query("search") search?: string
  ) {
    return this.subcategoriesService.list(auth, {
      categoryId,
      search
    });
  }

  @Post()
  create(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body()
    body: {
      categoryId: string;
      name: string;
      slug: string;
      costNature?: CostNature;
      essentiality?: Essentiality;
    }
  ) {
    return this.subcategoriesService.create(auth, body);
  }

  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") id: string,
    @Body()
    body: {
      categoryId?: string;
      name?: string;
      slug?: string;
      costNature?: CostNature;
      essentiality?: Essentiality;
    }
  ) {
    return this.subcategoriesService.update(auth, id, body);
  }

  @Delete(":id")
  archive(@CurrentAuth() auth: AuthenticatedRequestContext, @Param("id") id: string) {
    return this.subcategoriesService.archive(auth, id);
  }
}
