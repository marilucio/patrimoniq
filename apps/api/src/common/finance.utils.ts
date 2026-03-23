import {
  CategoryDirection,
  Prisma,
  TransactionStatus,
  TransactionType
} from "@prisma/client";

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

const inflowTypes = new Set<TransactionType>(["INCOME", "REFUND"]);
const outflowTypes = new Set<TransactionType>([
  "EXPENSE",
  "CREDIT_CARD_PAYMENT",
  "GOAL_CONTRIBUTION",
  "INVESTMENT",
  "LIABILITY_PAYMENT",
  "CREDIT_CARD_PURCHASE"
]);

const transactionTypeLabels: Record<TransactionType, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
  TRANSFER: "Transferencia",
  CREDIT_CARD_PURCHASE: "Compra no cartao",
  CREDIT_CARD_PAYMENT: "Pagamento do cartao",
  GOAL_CONTRIBUTION: "Aporte em meta",
  INVESTMENT: "Investimento",
  LIABILITY_PAYMENT: "Pagamento de divida",
  REFUND: "Reembolso"
};

const transactionStatusLabels: Record<TransactionStatus, string> = {
  CLEARED: "Compensada",
  PENDING: "Pendente",
  PLANNED: "Planejada",
  OVERDUE: "Atrasada",
  CANCELED: "Cancelada"
};

const categoryDirectionLabels: Record<CategoryDirection, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
  SAVING: "Poupanca",
  DEBT: "Divida"
};

const genericEnumLabels: Record<string, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupanca",
  CASH: "Dinheiro",
  INVESTMENT: "Investimento",
  WALLET: "Carteira",
  BENEFIT: "Beneficio",
  OTHER: "Outro",
  PIX: "Pix",
  DEBIT_CARD: "Cartao de debito",
  CREDIT_CARD: "Cartao de credito",
  ACCOUNT_DEBIT: "Debito em conta",
  BANK_SLIP: "Boleto",
  TRANSFER: "Transferencia",
  FIXED: "Fixa",
  VARIABLE: "Variavel",
  EXTRAORDINARY: "Extraordinaria",
  ESSENTIAL: "Essencial",
  IMPORTANT: "Importante",
  SUPERFLUOUS: "Superflua",
  IMPULSE: "Por impulso",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  YEARLY: "Anual",
  EMERGENCY_FUND: "Reserva de emergencia",
  RETIREMENT: "Aposentadoria",
  TRAVEL: "Viagem",
  EDUCATION: "Educacao",
  HOME: "Casa",
  CAR: "Carro",
  RENOVATION: "Reforma",
  CUSTOM: "Personalizada",
  CRITICAL: "Critica",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baixa",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  COMPLETED: "Concluida",
  PERSONAL_LOAN: "Emprestimo pessoal",
  MORTGAGE: "Hipoteca",
  AUTO_LOAN: "Financiamento de veiculo",
  FINANCING: "Financiamento",
  TAX: "Tributo",
  REAL_ESTATE: "Imovel",
  VEHICLE: "Veiculo",
  BUSINESS: "Negocio",
  INFO: "Informativo",
  WARNING: "Atencao",
  CRITICAL_ALERT: "Critico",
  CASHFLOW: "Fluxo de caixa",
  RISK: "Risco",
  DEBT: "Divida",
  GOAL: "Meta",
  BUDGET: "Orcamento",
  SUBSCRIPTION: "Assinatura",
  BEHAVIOR: "Comportamento",
  TAX_LABEL: "Tributo"
};

export function toNumber(value: DecimalLike): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return Number(value.toString());
}

export function startOfMonth(reference: Date): Date {
  return new Date(reference.getFullYear(), reference.getMonth(), 1);
}

export function endOfMonth(reference: Date): Date {
  return new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addMonths(reference: Date, amount: number): Date {
  return new Date(reference.getFullYear(), reference.getMonth() + amount, 1);
}

export function monthLabel(reference: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short"
  })
    .format(reference)
    .replace(".", "")
    .replace(/^\w/, (value) => value.toUpperCase());
}

export function isInflow(type: TransactionType): boolean {
  return inflowTypes.has(type);
}

export function isOutflow(type: TransactionType): boolean {
  return outflowTypes.has(type);
}

export function toDirection(type: TransactionType): "receita" | "despesa" | "transferencia" {
  if (type === "TRANSFER") {
    return "transferencia";
  }

  return isInflow(type) ? "receita" : "despesa";
}

export function signedAmount(type: TransactionType, amount: DecimalLike): number {
  const numericAmount = toNumber(amount);

  if (type === "TRANSFER") {
    return 0;
  }

  return isInflow(type) ? numericAmount : numericAmount * -1;
}

export function mapTransactionStatus(status: TransactionStatus): "compensada" | "planejada" | "atrasada" {
  if (status === "PLANNED" || status === "PENDING") {
    return "planejada";
  }

  if (status === "OVERDUE") {
    return "atrasada";
  }

  return "compensada";
}

export function parseTags(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item));
}

export function calculateAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function labelForTransactionType(value: TransactionType): string {
  return transactionTypeLabels[value];
}

export function labelForTransactionStatus(value: TransactionStatus): string {
  return transactionStatusLabels[value];
}

export function labelForCategoryDirection(value: CategoryDirection): string {
  return categoryDirectionLabels[value];
}

export function labelForEnum(value: string | null | undefined): string {
  if (!value) {
    return "Nao informado";
  }

  return genericEnumLabels[value] ?? value.toLowerCase().replace(/_/g, " ");
}
