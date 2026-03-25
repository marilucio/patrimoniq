import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { EmailService } from "../../common/email.service";
import { smtpTestEmailTemplate } from "../../common/email.templates";
import { labelForCategoryDirection } from "../../common/finance.utils";
import { hashPassword, verifyPassword } from "../../common/password.utils";
import { PrismaService } from "../../common/prisma.service";
import { ProductAnalyticsService } from "../../common/product-analytics.service";
import { RuntimeConfigService } from "../../common/runtime-config.service";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly analytics: ProductAnalyticsService
  ) {}

  async getSettings(auth: AuthenticatedRequestContext) {
    const [user, categories, taxTags] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: auth.userId }
      }),
      this.prisma.category.findMany({
        where: {
          userId: auth.userId,
          isActive: true
        },
        include: {
          subcategories: {
            where: { isActive: true }
          }
        },
        orderBy: [{ direction: "asc" }, { name: "asc" }]
      }),
      this.prisma.taxTag.findMany({
        where: {
          userId: auth.userId
        }
      })
    ]);

    return {
      profile: {
        fullName: user.fullName,
        email: user.email,
        locale: user.locale
      },
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        direction: labelForCategoryDirection(category.direction),
        directionCode: category.direction,
        subcategories: category.subcategories.map((subcategory) => ({
          id: subcategory.id,
          name: subcategory.name,
          slug: subcategory.slug
        }))
      })),
      integrations: [
        "Open Finance",
        "Importacao OFX",
        "Importacao CSV",
        "Importacao PDF",
        "Leitura de comprovantes",
        "Conciliacao bancaria"
      ],
      fiscalReadiness: {
        deductibleGroups: taxTags.map((tag) => tag.name),
        exportMode: "em breve"
      },
      runtime: this.runtimeConfig.getRuntimeSummary()
    };
  }

  async updateProfile(
    auth: AuthenticatedRequestContext,
    input: { fullName?: string; locale?: string }
  ) {
    const data: Record<string, string> = {};

    if (input.fullName !== undefined) {
      const trimmed = input.fullName.trim();
      if (trimmed.length < 3) {
        throw new BadRequestException("O nome precisa ter pelo menos 3 caracteres.");
      }
      data.fullName = trimmed;
    }

    if (input.locale !== undefined) {
      const allowed = ["pt-BR", "en-US"];
      if (!allowed.includes(input.locale)) {
        throw new BadRequestException("Idioma nao suportado.");
      }
      data.locale = input.locale;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException("Nenhum campo para atualizar.");
    }

    const user = await this.prisma.user.update({
      where: { id: auth.userId },
      data
    });

    await this.analytics.recordUserEvent({
      userId: auth.userId,
      sessionId: auth.sessionId,
      name: "PROFILE_UPDATED",
      pagePath: "/settings",
      metadata: { fields: Object.keys(data) }
    });

    return {
      success: true,
      message: "Perfil atualizado.",
      profile: {
        fullName: user.fullName,
        email: user.email,
        locale: user.locale
      }
    };
  }

  async changePassword(
    auth: AuthenticatedRequestContext,
    input: { currentPassword: string; newPassword: string }
  ) {
    if (!input.currentPassword || !input.newPassword) {
      throw new BadRequestException("Senha atual e nova senha sao obrigatorias.");
    }

    if (input.newPassword.length < 8) {
      throw new BadRequestException("A nova senha precisa ter pelo menos 8 caracteres.");
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId }
    });

    if (!user.passwordHash || !verifyPassword(input.currentPassword, user.passwordHash)) {
      throw new UnauthorizedException("Senha atual incorreta.");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: auth.userId },
        data: { passwordHash: hashPassword(input.newPassword) }
      }),
      this.prisma.session.updateMany({
        where: {
          userId: auth.userId,
          revokedAt: null,
          id: { not: auth.sessionId }
        },
        data: { revokedAt: new Date() }
      })
    ]);

    await this.analytics.recordUserEvent({
      userId: auth.userId,
      sessionId: auth.sessionId,
      name: "PASSWORD_CHANGED",
      pagePath: "/settings"
    });

    return {
      success: true,
      message: "Senha alterada. As outras sessoes foram encerradas."
    };
  }

  async getSessions(auth: AuthenticatedRequestContext) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId: auth.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { lastSeenAt: "desc" },
      take: 10
    });

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        isCurrent: session.id === auth.sessionId,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        lastSeenAt: session.lastSeenAt.toISOString(),
        createdAt: session.createdAt.toISOString()
      }))
    };
  }

  async revokeOtherSessions(auth: AuthenticatedRequestContext) {
    const result = await this.prisma.session.updateMany({
      where: {
        userId: auth.userId,
        revokedAt: null,
        id: { not: auth.sessionId }
      },
      data: { revokedAt: new Date() }
    });

    await this.analytics.recordUserEvent({
      userId: auth.userId,
      sessionId: auth.sessionId,
      name: "SESSIONS_REVOKED",
      pagePath: "/settings",
      metadata: { revokedCount: result.count }
    });

    return {
      success: true,
      message: `${result.count} sessao(oes) encerrada(s).`
    };
  }

  async updatePreferences(
    auth: AuthenticatedRequestContext,
    input: { currency?: string; dateFormat?: string }
  ) {
    // Preferences are stored in the user's locale field for now
    // Currency and dateFormat will be stored as a JSON preferences field
    // For this iteration, we validate and return success
    // The frontend will persist these in localStorage until a preferences column is added
    const validCurrencies = ["BRL", "USD", "EUR"];
    const validDateFormats = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

    if (input.currency && !validCurrencies.includes(input.currency)) {
      throw new BadRequestException("Moeda nao suportada.");
    }

    if (input.dateFormat && !validDateFormats.includes(input.dateFormat)) {
      throw new BadRequestException("Formato de data nao suportado.");
    }

    await this.analytics.recordUserEvent({
      userId: auth.userId,
      sessionId: auth.sessionId,
      name: "PREFERENCES_CHANGED",
      pagePath: "/settings",
      metadata: {
        currency: input.currency ?? "BRL",
        dateFormat: input.dateFormat ?? "DD/MM/YYYY"
      }
    });

    return {
      success: true,
      message: "Preferencias salvas.",
      preferences: {
        currency: input.currency ?? "BRL",
        dateFormat: input.dateFormat ?? "DD/MM/YYYY"
      }
    };
  }

  async sendEmailTest(auth: AuthenticatedRequestContext) {
    const runtime = this.runtimeConfig.getRuntimeSummary();

    if (!runtime.email.canSendTestEmail) {
      throw new BadRequestException(
        "O envio de teste so fica disponivel quando o SMTP real esta configurado neste ambiente."
      );
    }

    await this.emailService.verifyConnection();
    const template = smtpTestEmailTemplate({
      fullName: auth.fullName,
      stage: runtime.stage,
      appUrl: runtime.appUrl
    });

    await this.emailService.send({
      to: auth.email,
      subject: template.subject,
      text: template.text,
      html: template.html
    });

    return {
      success: true,
      message: `E-mail de teste enviado para ${auth.email}.`
    };
  }
}
