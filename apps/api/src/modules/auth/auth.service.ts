import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { seedDefaultCategories } from "../../common/default-categories";
import { EmailService } from "../../common/email.service";
import {
  passwordResetEmailTemplate,
  welcomeEmailTemplate,
} from "../../common/email.templates";
import { PrismaService } from "../../common/prisma.service";
import { ProductAnalyticsService } from "../../common/product-analytics.service";
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "../../common/password.utils";

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;

interface ResponseLike {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly analytics: ProductAnalyticsService,
  ) {}

  async register(input: {
    email: string;
    fullName: string;
    password: string;
    userAgent?: string;
    ipAddress?: string;
  }) {
    this.validateIdentity(input);

    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedName = input.fullName.trim();

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      if (process.env.AUTH_DEBUG_LOGS === "true") {
        this.logger.warn(`register-conflict email=${normalizedEmail}`);
      }
      throw new ConflictException("Ja existe um usuario com este e-mail.");
    }

    const result = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        fullName: normalizedName,
        passwordHash: hashPassword(input.password),
      },
    });

    await seedDefaultCategories(this.prisma, result.id);

    const session = await this.createSession(
      result.id,
      input.userAgent,
      input.ipAddress,
    );
    await this.analytics.recordUserEvent({
      userId: result.id,
      sessionId: session.id,
      name: "REGISTER_COMPLETED",
      pagePath: "/register",
      metadata: {
        locale: result.locale,
      },
    });
    void this.sendWelcomeEmail(result.email, result.fullName).catch((error) => {
      this.logger.warn(
        `Falha ao enviar e-mail de boas-vindas para ${result.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    return {
      sessionToken: session.token,
      payload: await this.buildAuthPayload(result.id),
    };
  }

  async login(input: {
    email: string;
    password: string;
    userAgent?: string;
    ipAddress?: string;
  }) {
    if (!input.email?.trim() || !input.password) {
      throw new BadRequestException("E-mail e senha sao obrigatorios.");
    }

    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (
      !user?.passwordHash ||
      !verifyPassword(input.password, user.passwordHash)
    ) {
      throw new UnauthorizedException("E-mail ou senha invalidos.");
    }

    const session = await this.createSession(
      user.id,
      input.userAgent,
      input.ipAddress,
    );
    await this.analytics.recordUserEvent({
      userId: user.id,
      sessionId: session.id,
      name: "LOGIN_COMPLETED",
      pagePath: "/login",
    });

    return {
      sessionToken: session.token,
      payload: await this.buildAuthPayload(user.id),
    };
  }

  async logout(auth: AuthenticatedRequestContext) {
    await this.prisma.session.update({
      where: { id: auth.sessionId },
      data: {
        revokedAt: new Date(),
      },
    });

    return {
      success: true,
    };
  }

  async me(auth: AuthenticatedRequestContext) {
    return this.buildAuthPayload(auth.userId);
  }

  async forgotPassword(input: { email: string }) {
    if (!input.email?.trim() || !input.email.includes("@")) {
      throw new BadRequestException("Informe um e-mail valido.");
    }

    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user?.passwordHash) {
      return {
        success: true,
        message:
          "Se existir uma conta com esse e-mail, enviaremos um link de redefinicao.",
      };
    }

    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const ttlMinutes = Number(
      process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? 60,
    );
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          consumedAt: null,
        },
        data: {
          consumedAt: new Date(),
        },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    const appUrl =
      process.env.APP_PUBLIC_URL ??
      process.env.FRONTEND_URL ??
      "http://localhost:3000";
    const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`;
    if (process.env.PASSWORD_RESET_DEBUG_LINKS === "true") {
      this.logger.log(`[password-reset-debug] ${user.email} -> ${resetUrl}`);
    }
    const template = passwordResetEmailTemplate({
      fullName: user.fullName,
      resetUrl,
      expiresInMinutes: ttlMinutes,
    });

    try {
      await this.emailService.send({
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
      await this.analytics.recordUserEvent({
        userId: user.id,
        name: "PASSWORD_RESET_REQUESTED",
        pagePath: "/forgot-password",
      });
    } catch (error) {
      this.logger.error(
        `Falha ao enviar e-mail de redefinicao para ${user.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        "Nao foi possivel enviar o e-mail agora. Tente novamente em instantes.",
      );
    }

    return {
      success: true,
      message:
        "Se existir uma conta com esse e-mail, enviaremos um link de redefinicao.",
    };
  }

  async resetPassword(input: { token: string; password: string }) {
    if (!input.token?.trim()) {
      throw new BadRequestException("Token de redefinicao obrigatorio.");
    }

    if (!input.password || input.password.length < 8) {
      throw new BadRequestException(
        "A nova senha precisa ter pelo menos 8 caracteres.",
      );
    }

    const tokenHash = hashSessionToken(input.token.trim());
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (
      !resetToken ||
      resetToken.consumedAt ||
      resetToken.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        "O link de redefinicao esta invalido ou expirou.",
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash: hashPassword(input.password),
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          consumedAt: new Date(),
        },
      }),
      this.prisma.session.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      message:
        "Senha redefinida com sucesso. Entre novamente com a nova senha.",
    };
  }

  setSessionCookie(response: ResponseLike, token: string) {
    const secureCookie =
      process.env.COOKIE_SECURE === "true" ||
      process.env.NODE_ENV === "production";
    response.cookie("patrimoniq_session", token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: this.readSameSite(),
      ...(process.env.COOKIE_DOMAIN
        ? { domain: process.env.COOKIE_DOMAIN }
        : {}),
      path: "/",
      maxAge: SESSION_MAX_AGE_MS,
    });
  }

  clearSessionCookie(response: ResponseLike) {
    const secureCookie =
      process.env.COOKIE_SECURE === "true" ||
      process.env.NODE_ENV === "production";
    response.clearCookie("patrimoniq_session", {
      httpOnly: true,
      sameSite: this.readSameSite(),
      secure: secureCookie,
      ...(process.env.COOKIE_DOMAIN
        ? { domain: process.env.COOKIE_DOMAIN }
        : {}),
      path: "/",
    });
  }

  private validateIdentity(input: {
    email: string;
    fullName: string;
    password: string;
  }) {
    if (!input.email?.includes("@")) {
      throw new BadRequestException("Informe um e-mail valido.");
    }

    if (!input.fullName?.trim() || input.fullName.trim().length < 3) {
      throw new BadRequestException("Informe um nome valido.");
    }

    if (!input.password || input.password.length < 8) {
      throw new BadRequestException(
        "A senha precisa ter pelo menos 8 caracteres.",
      );
    }
  }

  private readSameSite(): "lax" | "strict" | "none" {
    const sameSite = (process.env.COOKIE_SAME_SITE ?? "lax").toLowerCase();

    if (sameSite === "none" || sameSite === "strict") {
      return sameSite;
    }

    return "lax";
  }

  private async sendWelcomeEmail(email: string, fullName: string) {
    const appUrl =
      process.env.APP_PUBLIC_URL ??
      process.env.FRONTEND_URL ??
      "http://localhost:3000";
    const loginUrl = `${appUrl.replace(/\/$/, "")}/login`;
    const template = welcomeEmailTemplate({
      fullName,
      loginUrl,
    });

    await this.emailService.send({
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  private async createSession(
    userId: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const token = generateSessionToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashSessionToken(token),
        userAgent: userAgent ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
      },
    });

    return {
      id: session.id,
      token,
    };
  }

  private async buildAuthPayload(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("Usuario nao encontrado.");
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
    };
  }
}
