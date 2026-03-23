import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { FeedbackCategory } from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { FeedbackService } from "./feedback.service";

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

@Controller("feedback")
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  list(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Query("limit") limit?: string
  ) {
    return this.feedbackService.list(auth, Number(limit ?? 6));
  }

  @Post()
  submit(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body()
    body: {
      category?: FeedbackCategory;
      message: string;
      pagePath?: string;
    },
    @Req() request?: RequestLike
  ) {
    return this.feedbackService.submit(auth, body, {
      userAgent:
        typeof request?.headers["user-agent"] === "string"
          ? request.headers["user-agent"]
          : undefined
    });
  }
}
