import { Injectable } from "@nestjs/common";
import { EmailService } from "./email.service";
import { MonitoringService } from "./monitoring.service";

@Injectable()
export class RuntimeConfigService {
  constructor(
    private readonly emailService: EmailService,
    private readonly monitoringService: MonitoringService
  ) {}

  getRuntimeSummary() {
    const cookieSecure =
      process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
    const cookieDomain = process.env.COOKIE_DOMAIN?.trim() || null;
    const sameSite = (process.env.COOKIE_SAME_SITE ?? "lax").toLowerCase();
    const appUrl = process.env.APP_PUBLIC_URL ?? process.env.FRONTEND_URL ?? "http://localhost:3000";
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    const corsOrigins = (process.env.CORS_ORIGINS ?? frontendUrl)
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const email = this.emailService.getStatus();
    const monitoring = this.monitoringService.getStatus();
    const feedbackWebhook = process.env.FEEDBACK_WEBHOOK_URL?.trim();
    const feedbackEmail = process.env.FEEDBACK_EMAIL_TO?.trim();
    const feedbackRelayMode = feedbackWebhook
      ? "webhook"
      : feedbackEmail
        ? "email"
        : "database";
    const warnings: string[] = [];

    if (sameSite === "none" && !cookieSecure) {
      warnings.push("COOKIE_SAME_SITE=none exige COOKIE_SECURE=true em ambiente externo.");
    }

    if (!email.canSendRealEmail) {
      warnings.push("SMTP real ainda nao esta habilitado. Recuperacao de senha externa nao deve ser aberta.");
    }

    return {
      stage: process.env.APP_STAGE ?? process.env.NODE_ENV ?? "development",
      appUrl,
      frontendUrl,
      corsOrigins,
      session: {
        cookieSecure,
        sameSite,
        cookieDomain,
        proxyMode: (process.env.APP_PROXY_MODE ?? "same-origin").trim().toLowerCase()
      },
      email,
      monitoring,
      feedback: {
        inAppEnabled: true,
        relayMode: feedbackRelayMode,
        targetLabel:
          feedbackRelayMode === "webhook"
            ? "Webhook operacional configurado"
            : feedbackRelayMode === "email"
              ? "Encaminhamento por e-mail configurado"
              : "Armazenamento interno no banco"
      },
      warnings
    };
  }
}
