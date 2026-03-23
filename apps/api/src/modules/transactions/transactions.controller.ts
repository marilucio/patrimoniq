import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query
} from "@nestjs/common";
import {
  CostNature,
  Essentiality,
  PaymentMethod,
  TransactionStatus,
  TransactionType
} from "@prisma/client";
import { CurrentAuth } from "../../common/current-auth.decorator";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { TransactionsService } from "./transactions.service";

@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  list(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("direction") direction?: string,
    @Query("categoryId") categoryId?: string,
    @Query("subcategoryId") subcategoryId?: string
  ) {
    return this.transactionsService.list(auth, {
      page,
      pageSize,
      search,
      status,
      direction,
      categoryId,
      subcategoryId
    });
  }

  @Post()
  create(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body()
    body: {
      accountId?: string;
      counterpartyAccountId?: string;
      cardId?: string;
      categoryId?: string;
      subcategoryId?: string;
      type: TransactionType;
      status?: TransactionStatus;
      description: string;
      amount: number;
      postedAt: string;
      dueDate?: string;
      paymentMethod?: PaymentMethod;
      costNature?: CostNature;
      essentiality?: Essentiality;
      notes?: string;
      tags?: string[];
    }
  ) {
    return this.transactionsService.create(auth, body);
  }

  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Param("id") id: string,
    @Body()
    body: {
      accountId?: string;
      counterpartyAccountId?: string;
      cardId?: string;
      categoryId?: string;
      subcategoryId?: string;
      type?: TransactionType;
      status?: TransactionStatus;
      description?: string;
      amount?: number;
      postedAt?: string;
      dueDate?: string;
      paymentMethod?: PaymentMethod;
      costNature?: CostNature;
      essentiality?: Essentiality;
      notes?: string;
      tags?: string[];
    }
  ) {
    return this.transactionsService.update(auth, id, body);
  }

  @Delete(":id")
  cancel(@CurrentAuth() auth: AuthenticatedRequestContext, @Param("id") id: string) {
    return this.transactionsService.cancel(auth, id);
  }
}
