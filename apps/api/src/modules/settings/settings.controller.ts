import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
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

  @Patch("profile")
  updateProfile(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body() body: { fullName?: string; locale?: string }
  ) {
    return this.settingsService.updateProfile(auth, body);
  }

  @Post("password")
  changePassword(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body() body: { currentPassword: string; newPassword: string }
  ) {
    return this.settingsService.changePassword(auth, body);
  }

  @Get("sessions")
  getSessions(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.settingsService.getSessions(auth);
  }

  @Post("sessions/revoke-others")
  revokeOtherSessions(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.settingsService.revokeOtherSessions(auth);
  }

  @Patch("preferences")
  updatePreferences(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body() body: { currency?: string; dateFormat?: string }
  ) {
    return this.settingsService.updatePreferences(auth, body);
  }

  @Patch("notifications")
  updateNotificationPreferences(
    @CurrentAuth() auth: AuthenticatedRequestContext,
    @Body()
    body: {
      emailAlerts?: boolean;
      weeklyDigest?: boolean;
      dueDateReminders?: boolean;
      budgetAlerts?: boolean;
    }
  ) {
    return this.settingsService.updateNotificationPreferences(auth, body);
  }

  @Get("notifications")
  getNotificationPreferences(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.settingsService.getNotificationPreferences(auth);
  }

  @Post("diagnostics/email-test")
  sendEmailTest(@CurrentAuth() auth: AuthenticatedRequestContext) {
    return this.settingsService.sendEmailTest(auth);
  }
}
