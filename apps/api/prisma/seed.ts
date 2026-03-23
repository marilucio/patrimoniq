import { PrismaClient, Prisma, TransactionType } from "@prisma/client";
import { seedDefaultCategories } from "../src/common/default-categories";
import { hashPassword } from "../src/common/password.utils";

const prisma = new PrismaClient();

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

function isoDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function findCategory(userId: string, slug: string) {
  const category = await prisma.category.findFirstOrThrow({
    where: {
      userId,
      slug
    }
  });

  return category;
}

async function findSubcategory(userId: string, categorySlug: string, subcategorySlug: string) {
  const category = await findCategory(userId, categorySlug);

  return prisma.subcategory.findFirstOrThrow({
    where: {
      userId,
      categoryId: category.id,
      slug: subcategorySlug
    }
  });
}

async function createTransaction(input: {
  userId: string;
  accountId?: string;
  categoryId?: string;
  subcategoryId?: string;
  type: TransactionType;
  status?: "CLEARED" | "PLANNED" | "PENDING" | "OVERDUE";
  description: string;
  amount: number;
  postedAt: Date;
  dueDate?: Date;
  paymentMethod?: "PIX" | "ACCOUNT_DEBIT" | "DEBIT_CARD" | "CREDIT_CARD" | "TRANSFER";
  costNature?: "FIXED" | "VARIABLE" | "EXTRAORDINARY";
  essentiality?: "ESSENTIAL" | "IMPORTANT" | "SUPERFLUOUS" | "IMPULSE";
  tags?: string[];
}) {
  return prisma.transaction.create({
    data: {
      userId: input.userId,
      accountId: input.accountId ?? null,
      categoryId: input.categoryId ?? null,
      subcategoryId: input.subcategoryId ?? null,
      createdByUserId: input.userId,
      type: input.type,
      status: input.status ?? "CLEARED",
      source: "MANUAL",
      description: input.description,
      amount: decimal(input.amount),
      postedAt: input.postedAt,
      dueDate: input.dueDate ?? null,
      paymentMethod: input.paymentMethod ?? null,
      costNature: input.costNature ?? null,
      essentiality: input.essentiality ?? null,
      tags: input.tags ?? []
    }
  });
}

async function recalculateAccountBalance(accountId: string) {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId }
  });

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: account.userId,
      accountId,
      status: "CLEARED"
    }
  });

  const balance = transactions.reduce((sum, transaction) => {
    if (transaction.type === "INCOME" || transaction.type === "REFUND") {
      return sum + Number(transaction.amount);
    }

    if (transaction.type === "TRANSFER") {
      return sum;
    }

    return sum - Number(transaction.amount);
  }, Number(account.openingBalance));

  await prisma.account.update({
    where: { id: accountId },
    data: {
      currentBalance: decimal(balance)
    }
  });
}

async function seedUserRicardo() {
  const user = await prisma.user.upsert({
    where: { email: "ricardo@patrimoniq.local" },
    update: {
      fullName: "Ricardo Monteiro",
      passwordHash: hashPassword("Patrimoniq123!")
    },
    create: {
      email: "ricardo@patrimoniq.local",
      fullName: "Ricardo Monteiro",
      passwordHash: hashPassword("Patrimoniq123!")
    }
  });

  await seedDefaultCategories(prisma, user.id);

  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.budget.deleteMany({ where: { userId: user.id } });
  await prisma.goalContribution.deleteMany({ where: { userId: user.id } });
  await prisma.goal.deleteMany({ where: { userId: user.id } });
  await prisma.asset.deleteMany({ where: { userId: user.id } });
  await prisma.liability.deleteMany({ where: { userId: user.id } });
  await prisma.netWorthSnapshot.deleteMany({ where: { userId: user.id } });
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.alert.deleteMany({ where: { userId: user.id } });
  await prisma.insight.deleteMany({ where: { userId: user.id } });
  await prisma.scoreHistory.deleteMany({ where: { userId: user.id } });
  await prisma.mission.deleteMany({ where: { userId: user.id } });

  const contaPrincipal = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Conta principal",
      type: "CHECKING",
      institutionName: "Banco do Brasil",
      openingBalance: decimal(3500),
      currentBalance: decimal(3500)
    }
  });

  const reserva = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Reserva",
      type: "SAVINGS",
      institutionName: "NuConta",
      openingBalance: decimal(4800),
      currentBalance: decimal(4800)
    }
  });

  const investimentos = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Investimentos",
      type: "INVESTMENT",
      institutionName: "XP",
      openingBalance: decimal(9200),
      currentBalance: decimal(9200)
    }
  });

  const categoriaReceitas = await findCategory(user.id, "receitas");
  const categoriaMoradia = await findCategory(user.id, "moradia");
  const categoriaMercado = await findCategory(user.id, "alimentacao-casa");
  const categoriaFora = await findCategory(user.id, "alimentacao-fora");
  const categoriaTransporte = await findCategory(user.id, "transporte");
  const categoriaAssinaturas = await findCategory(user.id, "assinaturas");
  const categoriaReserva = await findCategory(user.id, "reserva");
  const categoriaDividas = await findCategory(user.id, "dividas");

  const salario = await findSubcategory(user.id, "receitas", "salario");
  const aluguel = await findSubcategory(user.id, "moradia", "aluguel");
  const mercado = await findSubcategory(user.id, "alimentacao-casa", "mercado");
  const delivery = await findSubcategory(user.id, "alimentacao-fora", "delivery");
  const combustivel = await findSubcategory(user.id, "transporte", "combustivel");
  const video = await findSubcategory(user.id, "assinaturas", "video");
  const reservaPrincipal = await findSubcategory(user.id, "reserva", "reserva-principal");
  const cartaoCredito = await findSubcategory(user.id, "dividas", "cartao-credito");

  const months = [
    { y: 2025, m: 10, income: 8900, expenses: 6720 },
    { y: 2025, m: 11, income: 9100, expenses: 7010 },
    { y: 2025, m: 12, income: 9600, expenses: 7680 },
    { y: 2026, m: 1, income: 9200, expenses: 6890 },
    { y: 2026, m: 2, income: 9300, expenses: 7085 },
    { y: 2026, m: 3, income: 9550, expenses: 7350 }
  ];

  for (const month of months) {
    await createTransaction({
      userId: user.id,
      accountId: contaPrincipal.id,
      categoryId: categoriaReceitas.id,
      subcategoryId: salario.id,
      type: "INCOME",
      description: `Salario ${month.m}/${month.y}`,
      amount: month.income,
      postedAt: isoDate(month.y, month.m, 5),
      paymentMethod: "TRANSFER"
    });

    await createTransaction({
      userId: user.id,
      accountId: contaPrincipal.id,
      categoryId: categoriaMoradia.id,
      subcategoryId: aluguel.id,
      type: "EXPENSE",
      description: `Aluguel ${month.m}/${month.y}`,
      amount: 2200,
      postedAt: isoDate(month.y, month.m, 8),
      paymentMethod: "ACCOUNT_DEBIT",
      costNature: "FIXED",
      essentiality: "ESSENTIAL"
    });

    await createTransaction({
      userId: user.id,
      accountId: contaPrincipal.id,
      categoryId: categoriaMercado.id,
      subcategoryId: mercado.id,
      type: "EXPENSE",
      description: `Mercado ${month.m}/${month.y}`,
      amount: 1150 + (month.m % 3) * 90,
      postedAt: isoDate(month.y, month.m, 12),
      paymentMethod: "DEBIT_CARD",
      costNature: "VARIABLE",
      essentiality: "ESSENTIAL"
    });

    await createTransaction({
      userId: user.id,
      accountId: contaPrincipal.id,
      categoryId: categoriaFora.id,
      subcategoryId: delivery.id,
      type: "EXPENSE",
      description: `Delivery ${month.m}/${month.y}`,
      amount: 320 + (month.m % 4) * 110,
      postedAt: isoDate(month.y, month.m, 18),
      paymentMethod: "CREDIT_CARD",
      costNature: "VARIABLE",
      essentiality: "SUPERFLUOUS",
      tags: ["delivery"]
    });

    await createTransaction({
      userId: user.id,
      accountId: contaPrincipal.id,
      categoryId: categoriaTransporte.id,
      subcategoryId: combustivel.id,
      type: "EXPENSE",
      description: `Combustivel ${month.m}/${month.y}`,
      amount: 420 + (month.m % 2) * 85,
      postedAt: isoDate(month.y, month.m, 21),
      paymentMethod: "CREDIT_CARD",
      costNature: "VARIABLE",
      essentiality: "IMPORTANT"
    });

    await createTransaction({
      userId: user.id,
      accountId: contaPrincipal.id,
      categoryId: categoriaAssinaturas.id,
      subcategoryId: video.id,
      type: "EXPENSE",
      description: `Streaming ${month.m}/${month.y}`,
      amount: 69.9,
      postedAt: isoDate(month.y, month.m, 24),
      paymentMethod: "CREDIT_CARD",
      costNature: "FIXED",
      essentiality: "SUPERFLUOUS"
    });
  }

  await createTransaction({
    userId: user.id,
    accountId: contaPrincipal.id,
    categoryId: categoriaReserva.id,
    subcategoryId: reservaPrincipal.id,
    type: "GOAL_CONTRIBUTION",
    description: "Aporte para reserva",
    amount: 600,
    postedAt: isoDate(2026, 3, 15),
    paymentMethod: "TRANSFER",
    costNature: "FIXED",
    essentiality: "IMPORTANT"
  });

  await createTransaction({
    userId: user.id,
    accountId: contaPrincipal.id,
    categoryId: categoriaDividas.id,
    subcategoryId: cartaoCredito.id,
    type: "LIABILITY_PAYMENT",
    description: "Pagamento parcial do cartao",
    amount: 900,
    postedAt: isoDate(2026, 3, 20),
    paymentMethod: "TRANSFER",
    costNature: "FIXED",
    essentiality: "IMPORTANT"
  });

  await createTransaction({
    userId: user.id,
    accountId: contaPrincipal.id,
    categoryId: categoriaMoradia.id,
    subcategoryId: aluguel.id,
    type: "EXPENSE",
    status: "PENDING",
    description: "Aluguel de abril",
    amount: 2200,
    postedAt: isoDate(2026, 3, 28),
    dueDate: isoDate(2026, 3, 28),
    paymentMethod: "ACCOUNT_DEBIT",
    costNature: "FIXED",
    essentiality: "ESSENTIAL"
  });

  await createTransaction({
    userId: user.id,
    accountId: contaPrincipal.id,
    categoryId: categoriaDividas.id,
    subcategoryId: cartaoCredito.id,
    type: "EXPENSE",
    status: "PLANNED",
    description: "Fatura do cartao",
    amount: 1380,
    postedAt: isoDate(2026, 3, 27),
    dueDate: isoDate(2026, 3, 27),
    paymentMethod: "CREDIT_CARD",
    costNature: "FIXED",
    essentiality: "IMPORTANT"
  });

  await prisma.budget.createMany({
    data: [
      {
        userId: user.id,
        name: "Moradia",
        categoryId: categoriaMoradia.id,
        subcategoryId: aluguel.id,
        cadence: "MONTHLY",
        periodStart: isoDate(2026, 3, 1),
        periodEnd: isoDate(2026, 3, 31),
        amountLimit: decimal(2200),
        alertThresholdPercent: 90
      },
      {
        userId: user.id,
        name: "Mercado",
        categoryId: categoriaMercado.id,
        subcategoryId: mercado.id,
        cadence: "MONTHLY",
        periodStart: isoDate(2026, 3, 1),
        periodEnd: isoDate(2026, 3, 31),
        amountLimit: decimal(1400),
        alertThresholdPercent: 85
      },
      {
        userId: user.id,
        name: "Delivery",
        categoryId: categoriaFora.id,
        subcategoryId: delivery.id,
        cadence: "MONTHLY",
        periodStart: isoDate(2026, 3, 1),
        periodEnd: isoDate(2026, 3, 31),
        amountLimit: decimal(500),
        alertThresholdPercent: 80
      }
    ]
  });

  await prisma.goal.createMany({
    data: [
      {
        userId: user.id,
        name: "Reserva de emergencia",
        kind: "EMERGENCY_FUND",
        priority: "CRITICAL",
        targetAmount: decimal(18000),
        currentAmount: decimal(6800),
        monthlyContributionTarget: decimal(900),
        targetDate: isoDate(2026, 12, 1)
      },
      {
        userId: user.id,
        name: "Viagem de ferias",
        kind: "TRAVEL",
        priority: "MEDIUM",
        targetAmount: decimal(8500),
        currentAmount: decimal(2100),
        monthlyContributionTarget: decimal(500),
        targetDate: isoDate(2027, 2, 1)
      }
    ]
  });

  await prisma.asset.createMany({
    data: [
      {
        userId: user.id,
        linkedAccountId: reserva.id,
        name: "Reserva de emergencia",
        type: "CASH",
        currentValue: decimal(6800)
      },
      {
        userId: user.id,
        linkedAccountId: investimentos.id,
        name: "Tesouro Selic",
        type: "INVESTMENT",
        currentValue: decimal(12500)
      },
      {
        userId: user.id,
        name: "Carro",
        type: "VEHICLE",
        currentValue: decimal(32000)
      }
    ]
  });

  await prisma.liability.createMany({
    data: [
      {
        userId: user.id,
        name: "Cartao principal",
        type: "CREDIT_CARD",
        currentBalance: decimal(1800),
        monthlyPayment: decimal(900),
        isHighPriority: true
      },
      {
        userId: user.id,
        name: "Emprestimo pessoal",
        type: "PERSONAL_LOAN",
        currentBalance: decimal(4200),
        monthlyPayment: decimal(480)
      }
    ]
  });

  await prisma.netWorthSnapshot.createMany({
    data: [
      { userId: user.id, snapshotDate: isoDate(2025, 10, 1), totalAssets: decimal(42200), totalLiabilities: decimal(9800), netWorth: decimal(32400), liquidReserve: decimal(4200), investedAssets: decimal(8700) },
      { userId: user.id, snapshotDate: isoDate(2025, 11, 1), totalAssets: decimal(43800), totalLiabilities: decimal(9200), netWorth: decimal(34600), liquidReserve: decimal(4500), investedAssets: decimal(9300) },
      { userId: user.id, snapshotDate: isoDate(2025, 12, 1), totalAssets: decimal(45100), totalLiabilities: decimal(9100), netWorth: decimal(36000), liquidReserve: decimal(5100), investedAssets: decimal(9700) },
      { userId: user.id, snapshotDate: isoDate(2026, 1, 1), totalAssets: decimal(46800), totalLiabilities: decimal(8600), netWorth: decimal(38200), liquidReserve: decimal(5700), investedAssets: decimal(10400) },
      { userId: user.id, snapshotDate: isoDate(2026, 2, 1), totalAssets: decimal(48900), totalLiabilities: decimal(7600), netWorth: decimal(41300), liquidReserve: decimal(6200), investedAssets: decimal(11200) },
      { userId: user.id, snapshotDate: isoDate(2026, 3, 1), totalAssets: decimal(51300), totalLiabilities: decimal(6000), netWorth: decimal(45300), liquidReserve: decimal(6800), investedAssets: decimal(12500) }
    ]
  });

  await prisma.scoreHistory.createMany({
    data: [
      {
        userId: user.id,
        snapshotDate: isoDate(2026, 1, 1),
        overallScore: 69,
        organizationScore: 74,
        predictabilityScore: 68,
        disciplineScore: 64,
        protectionScore: 61,
        growthScore: 70,
        debtScore: 75
      },
      {
        userId: user.id,
        snapshotDate: isoDate(2026, 2, 1),
        overallScore: 72,
        organizationScore: 76,
        predictabilityScore: 71,
        disciplineScore: 67,
        protectionScore: 65,
        growthScore: 73,
        debtScore: 79
      },
      {
        userId: user.id,
        snapshotDate: isoDate(2026, 3, 1),
        overallScore: 76,
        organizationScore: 79,
        predictabilityScore: 74,
        disciplineScore: 71,
        protectionScore: 69,
        growthScore: 77,
        debtScore: 82
      }
    ]
  });

  await prisma.mission.create({
    data: {
      userId: user.id,
      type: "DELIVERY_DETOX",
      status: "ACTIVE",
      title: "Menos delivery nesta semana",
      description: "Fique sete dias sem delivery e redirecione a economia para sua reserva.",
      progressCurrent: 3,
      progressTarget: 7,
      startsAt: isoDate(2026, 3, 16),
      endsAt: isoDate(2026, 3, 23)
    }
  });

  await recalculateAccountBalance(contaPrincipal.id);
  await recalculateAccountBalance(reserva.id);
  await recalculateAccountBalance(investimentos.id);
}

async function seedUserAna() {
  const user = await prisma.user.upsert({
    where: { email: "ana@patrimoniq.local" },
    update: {
      fullName: "Ana Martins",
      passwordHash: hashPassword("Patrimoniq123!")
    },
    create: {
      email: "ana@patrimoniq.local",
      fullName: "Ana Martins",
      passwordHash: hashPassword("Patrimoniq123!")
    }
  });

  await seedDefaultCategories(prisma, user.id);
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.goal.deleteMany({ where: { userId: user.id } });
  await prisma.asset.deleteMany({ where: { userId: user.id } });
  await prisma.liability.deleteMany({ where: { userId: user.id } });
  await prisma.netWorthSnapshot.deleteMany({ where: { userId: user.id } });
  await prisma.scoreHistory.deleteMany({ where: { userId: user.id } });

  const conta = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Conta digital",
      type: "CHECKING",
      institutionName: "Inter",
      openingBalance: decimal(1800),
      currentBalance: decimal(1800)
    }
  });

  const receitas = await findCategory(user.id, "receitas");
  const salario = await findSubcategory(user.id, "receitas", "salario");

  await createTransaction({
    userId: user.id,
    accountId: conta.id,
    categoryId: receitas.id,
    subcategoryId: salario.id,
    type: "INCOME",
    description: "Salario de marco",
    amount: 5200,
    postedAt: isoDate(2026, 3, 5)
  });

  await prisma.goal.create({
    data: {
      userId: user.id,
      name: "Reserva inicial",
      kind: "EMERGENCY_FUND",
      priority: "HIGH",
      targetAmount: decimal(9000),
      currentAmount: decimal(1800),
      monthlyContributionTarget: decimal(500)
    }
  });
}

async function main() {
  await seedUserRicardo();
  await seedUserAna();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
