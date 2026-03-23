import { BadRequestException, Injectable } from "@nestjs/common";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { EmailService } from "../../common/email.service";
import { smtpTestEmailTemplate } from "../../common/email.templates";
import { labelForCategoryDirection } from "../../common/finance.utils";
import { PrismaService } from "../../common/prisma.service";
import { RuntimeConfigService } from "../../common/runtime-config.service";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly runtimeConfig: RuntimeConfigService
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
