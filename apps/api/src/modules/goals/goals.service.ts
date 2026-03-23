import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { GoalKind, GoalPriority, Prisma } from "@prisma/client";
import type { AuthenticatedRequestContext } from "../../common/auth.types";
import { addMonths, monthLabel, labelForEnum, toNumber } from "../../common/finance.utils";
import { PrismaService } from "../../common/prisma.service";
import { ProductAnalyticsService } from "../../common/product-analytics.service";

interface GoalInput {
  name: string;
  kind: GoalKind;
  priority: GoalPriority;
  targetAmount: number;
  currentAmount?: number;
  monthlyContributionTarget?: number;
  targetDate?: string;
  notes?: string;
}

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: ProductAnalyticsService
  ) {}

  async list(auth: AuthenticatedRequestContext) {
    const [goals, liabilities] = await Promise.all([
      this.prisma.goal.findMany({
        where: {
          userId: auth.userId,
          status: {
            in: ["ACTIVE", "PAUSED"]
          }
        },
        include: {
          contributions: {
            orderBy: { contributionDate: "desc" }
          }
        },
        orderBy: [{ priority: "asc" }, { targetDate: "asc" }]
      }),
      this.prisma.liability.findMany({
        where: { userId: auth.userId, isArchived: false }
      })
    ]);

    const items = goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      kind: labelForEnum(goal.kind),
      kindCode: goal.kind,
      status: labelForEnum(goal.status),
      statusCode: goal.status,
      targetAmount: toNumber(goal.targetAmount),
      currentAmount: toNumber(goal.currentAmount),
      monthlyTarget:
        toNumber(goal.monthlyContributionTarget) ||
        Math.max(
          Math.round((toNumber(goal.targetAmount) - toNumber(goal.currentAmount)) / 12),
          0
        ),
      priority: labelForEnum(goal.priority),
      priorityCode: goal.priority,
      notes: goal.notes ?? "",
      targetDate:
        goal.targetDate?.toISOString().slice(0, 10) ??
        addMonths(new Date(), 12).toISOString().slice(0, 10)
    }));

    return {
      items,
      simulations: [
        {
          id: "sim-aporte",
          label: "Aumentar aporte mensal em 10%",
          impact: `+R$ ${Math.round(items.reduce((sum, item) => sum + item.monthlyTarget, 0) * 0.1)}`,
          outcome: `As metas ativas ganham tracao ja em ${monthLabel(addMonths(new Date(), 1))}.`
        },
        {
          id: "sim-divida",
          label: "Redirecionar sobra apos quitar uma divida",
          impact: `R$ ${Math.round(liabilities.reduce((sum, item) => sum + toNumber(item.monthlyPayment), 0))} por mes`,
          outcome: "Aceleracao direta das metas prioritarias."
        }
      ]
    };
  }

  async create(auth: AuthenticatedRequestContext, input: GoalInput) {
    this.validate(input);

    const goal = await this.prisma.goal.create({
      data: {
        userId: auth.userId,
        name: input.name.trim(),
        kind: input.kind,
        priority: input.priority,
        targetAmount: new Prisma.Decimal(input.targetAmount),
        currentAmount: new Prisma.Decimal(input.currentAmount ?? 0),
        monthlyContributionTarget:
          input.monthlyContributionTarget !== undefined
            ? new Prisma.Decimal(input.monthlyContributionTarget)
            : null,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        notes: input.notes ?? null
      }
    });

    const activeGoalsCount = await this.prisma.goal.count({
      where: {
        userId: auth.userId,
        status: {
          not: "CANCELED"
        }
      }
    });

    if (activeGoalsCount === 1) {
      await this.analytics.recordOnceForUser({
        userId: auth.userId,
        sessionId: auth.sessionId,
        name: "FIRST_GOAL_CREATED",
        pagePath: "/goals",
        metadata: {
          kind: goal.kind,
          targetAmount: input.targetAmount
        }
      });
    }

    return goal;
  }

  async update(
    auth: AuthenticatedRequestContext,
    goalId: string,
    input: Partial<GoalInput>
  ) {
    const goal = await this.prisma.goal.findFirst({
      where: {
        id: goalId,
        userId: auth.userId,
        status: {
          not: "CANCELED"
        }
      }
    });

    if (!goal) {
      throw new NotFoundException("Meta nao encontrada.");
    }

    return this.prisma.goal.update({
      where: { id: goal.id },
      data: {
        name: input.name?.trim() || goal.name,
        kind: input.kind ?? goal.kind,
        priority: input.priority ?? goal.priority,
        targetAmount:
          input.targetAmount !== undefined
            ? new Prisma.Decimal(input.targetAmount)
            : goal.targetAmount,
        currentAmount:
          input.currentAmount !== undefined
            ? new Prisma.Decimal(input.currentAmount)
            : goal.currentAmount,
        monthlyContributionTarget:
          input.monthlyContributionTarget !== undefined
            ? new Prisma.Decimal(input.monthlyContributionTarget)
            : goal.monthlyContributionTarget,
        targetDate:
          input.targetDate !== undefined
            ? input.targetDate
              ? new Date(input.targetDate)
              : null
            : goal.targetDate,
        notes: input.notes !== undefined ? input.notes || null : goal.notes
      }
    });
  }

  async cancel(auth: AuthenticatedRequestContext, goalId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: {
        id: goalId,
        userId: auth.userId,
        status: {
          not: "CANCELED"
        }
      }
    });

    if (!goal) {
      throw new NotFoundException("Meta nao encontrada.");
    }

    await this.prisma.goal.update({
      where: { id: goal.id },
      data: {
        status: "CANCELED"
      }
    });

    return { success: true };
  }

  private validate(input: GoalInput) {
    if (!input.name?.trim()) {
      throw new BadRequestException("Nome da meta obrigatorio.");
    }

    if (input.targetAmount === undefined || Number.isNaN(input.targetAmount) || input.targetAmount <= 0) {
      throw new BadRequestException("Valor alvo da meta precisa ser maior que zero.");
    }
  }
}
