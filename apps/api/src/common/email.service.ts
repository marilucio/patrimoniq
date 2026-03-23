import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import nodemailer from "nodemailer";
import { MonitoringService } from "./monitoring.service";

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

type EmailProvider = "auto" | "console" | "smtp";

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporterPromise: Promise<nodemailer.Transporter> | null = null;
  private fallbackLogged = false;

  constructor(private readonly monitoringService: MonitoringService) {}

  async onModuleInit() {
    const provider = this.resolveProvider();

    if (provider === "console") {
      this.logger.warn("SMTP nao configurado. O envio de e-mails segue em modo console.");
      return;
    }

    const shouldVerify =
      process.env.SMTP_VERIFY_CONNECTION === "true" ||
      (provider === "smtp" && process.env.SMTP_VERIFY_CONNECTION !== "false");

    if (!shouldVerify) {
      return;
    }

    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      this.logger.log("Conexao SMTP validada com sucesso.");
    } catch (error) {
      const message = `Falha ao validar SMTP: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(message);
      void this.monitoringService.capture({
        level: "error",
        title: "Falha ao validar SMTP",
        message,
        context: {
          provider
        },
        stack: error instanceof Error ? error.stack : undefined
      });

      if ((process.env.EMAIL_PROVIDER ?? "auto").toLowerCase() === "smtp") {
        throw error;
      }
    }
  }

  async send(message: EmailMessage) {
    const provider = this.resolveProvider();

    if (provider === "console") {
      if (!this.fallbackLogged) {
        this.logger.warn("Usando fallback de e-mail em console. Defina SMTP_* para envio real.");
        this.fallbackLogged = true;
      }

      this.logger.log(
        [
          `EMAIL TO: ${message.to}`,
          `SUBJECT: ${message.subject}`,
          message.text
        ].join("\n")
      );
      return {
        delivered: false,
        provider: "console"
      };
    }

    const transport = await this.getTransporter();
    const result = await transport.sendMail({
      from: {
        name: process.env.EMAIL_FROM_NAME ?? "Patrimoniq",
        address: process.env.EMAIL_FROM_ADDRESS ?? "noreply@patrimoniq.local"
      },
      ...(process.env.EMAIL_REPLY_TO ? { replyTo: process.env.EMAIL_REPLY_TO } : {}),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html
    });

    this.logger.log(`E-mail enviado para ${message.to} via SMTP (${result.messageId}).`);

    return {
      delivered: true,
      provider: "smtp",
      messageId: result.messageId
    };
  }

  getStatus() {
    const configuredProvider = (process.env.EMAIL_PROVIDER ?? "auto").trim().toLowerCase();
    const resolvedProvider = this.resolveProvider();
    const fromAddress = process.env.EMAIL_FROM_ADDRESS?.trim() || "noreply@patrimoniq.local";
    const replyTo = process.env.EMAIL_REPLY_TO?.trim() || null;

    return {
      configuredProvider,
      resolvedProvider,
      fromAddress,
      replyTo,
      canSendRealEmail: resolvedProvider === "smtp",
      canSendTestEmail:
        resolvedProvider === "smtp" && (process.env.ENABLE_SMTP_SELF_TEST ?? "true") !== "false"
    };
  }

  async verifyConnection() {
    if (this.resolveProvider() === "console") {
      return {
        ok: false,
        provider: "console",
        message: "SMTP real ainda nao esta configurado neste ambiente."
      };
    }

    const transporter = await this.getTransporter();
    await transporter.verify();

    return {
      ok: true,
      provider: "smtp",
      message: "Conexao SMTP validada com sucesso."
    };
  }

  private resolveProvider(): Exclude<EmailProvider, "auto"> {
    const configured = (process.env.EMAIL_PROVIDER ?? "auto").trim().toLowerCase() as EmailProvider;

    if (configured === "console") {
      return "console";
    }

    const smtpConfigured = this.hasSmtpConfig();

    if (configured === "smtp") {
      if (!smtpConfigured) {
        throw new Error("EMAIL_PROVIDER=smtp exige SMTP_HOST, EMAIL_FROM_ADDRESS e credenciais coerentes.");
      }

      return "smtp";
    }

    return smtpConfigured ? "smtp" : "console";
  }

  private hasSmtpConfig() {
    const host = process.env.SMTP_HOST?.trim();
    const fromAddress = process.env.EMAIL_FROM_ADDRESS?.trim();
    const hasUser = Boolean(process.env.SMTP_USER?.trim());
    const hasPassword = Boolean(process.env.SMTP_PASSWORD?.trim());

    if (hasUser !== hasPassword) {
      return false;
    }

    return Boolean(host && fromAddress);
  }

  private async getTransporter() {
    if (!this.transporterPromise) {
      this.transporterPromise = Promise.resolve(
        nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
          secure: process.env.SMTP_SECURE === "true",
          auth:
            process.env.SMTP_USER && process.env.SMTP_PASSWORD
              ? {
                  user: process.env.SMTP_USER,
                  pass: process.env.SMTP_PASSWORD
                }
              : undefined
        })
      );
    }

    return this.transporterPromise;
  }
}
