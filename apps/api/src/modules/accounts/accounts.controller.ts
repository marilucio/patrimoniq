import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { AccountType } from "@prisma/client";
import { CurrentAuth } from "../../common/current-auth.decorator";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { AccountsService } from "./accounts.service";

@Controller("accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.accountsService.list(auth);
  }

  @Post()
  create(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body()
    body: {
      name: string;
      type: AccountType;
      institutionName?: string;
      openingBalance?: number;
    }
  ) {
    return this.accountsService.create(auth, body);
  }

  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      type?: AccountType;
      institutionName?: string;
      openingBalance?: number;
    }
  ) {
    return this.accountsService.update(auth, id, body);
  }

  @Delete(":id")
  archive(@CurrentAuth() auth: AuthenticatedRequestContext, @Param("id") id: string) {
    return this.accountsService.archive(auth, id);
  }
}
