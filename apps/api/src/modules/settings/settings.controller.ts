import { Controller, Get, Post } from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { SettingsService } from "./settings.service";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.settingsService.getSettings(auth);
  }

  @Post("diagnostics/email-test")
  sendEmailTest(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.settingsService.sendEmailTest(auth);
  }
}
