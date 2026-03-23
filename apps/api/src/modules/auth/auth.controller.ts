import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res
} from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { Public } from "../../common/public.decorator";
import { AuthService } from "./auth.service";

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

interface ResponseLike {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  async register(
    @Body() body: { email: string; fullName: string; password: string },
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike
  ) {
    const result = await this.authService.register({
      ...body,
      userAgent:
        typeof request.headers["user-agent"] === "string"
          ? request.headers["user-agent"]
          : undefined,
      ipAddress: request.ip
    });
    this.authService.setSessionCookie(response, result.sessionToken);
    return result.payload;
  }

  @Public()
  @Post("login")
  async login(
    @Body() body: { email: string; password: string },
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike
  ) {
    const result = await this.authService.login({
      ...body,
      userAgent:
        typeof request.headers["user-agent"] === "string"
          ? request.headers["user-agent"]
          : undefined,
      ipAddress: request.ip
    });
    this.authService.setSessionCookie(response, result.sessionToken);
    return result.payload;
  }

  @Public()
  @Post("password/forgot")
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body);
  }

  @Public()
  @Post("password/reset")
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body);
  }

  @Post("logout")
  async logout(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Res({ passthrough: true }) response: ResponseLike
  ) {
    this.authService.clearSessionCookie(response);
    return this.authService.logout(auth);
  }

  @Get("me")
  me(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.authService.me(auth);
  }
}
