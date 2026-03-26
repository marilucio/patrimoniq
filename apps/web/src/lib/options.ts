const labels: Record<string, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
  TRANSFER: "Transferencia",
  GOAL_CONTRIBUTION: "Aporte em meta",
  INVESTMENT: "Investimento",
  LIABILITY_PAYMENT: "Pagamento de divida",
  CREDIT_CARD_PURCHASE: "Compra no cartao",
  CREDIT_CARD_PAYMENT: "Pagamento do cartao",
  REFUND: "Reembolso",
  CLEARED: "Compensada",
  PLANNED: "Planejada",
  PENDING: "Pendente",
  OVERDUE: "Atrasada",
  PIX: "Pix",
  CASH: "Dinheiro",
  DEBIT_CARD: "Cartao de debito",
  CREDIT_CARD: "Cartao de credito",
  ACCOUNT_DEBIT: "Debito em conta",
  BANK_SLIP: "Boleto",
  OTHER: "Outro",
  FIXED: "Fixa",
  VARIABLE: "Variavel",
  EXTRAORDINARY: "Extraordinaria",
  ESSENTIAL: "Essencial",
  IMPORTANT: "Importante",
  SUPERFLUOUS: "Superflua",
  IMPULSE: "Por impulso",
  CHECKING: "Conta corrente",
  SAVINGS: "Poupanca",
  INVESTMENT_ACCOUNT: "Investimento",
  WALLET: "Carteira",
  BENEFIT: "Beneficio",
  EXPENSE_DIRECTION: "Despesa",
  INCOME_DIRECTION: "Receita",
  SAVING: "Poupanca",
  DEBT: "Divida",
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
  CASH_ASSET: "Dinheiro",
  REAL_ESTATE: "Imovel",
  VEHICLE: "Veiculo",
  BUSINESS: "Negocio",
  PERSONAL_LOAN: "Emprestimo pessoal",
  MORTGAGE: "Hipoteca",
  AUTO_LOAN: "Financiamento de veiculo",
  FINANCING: "Financiamento",
  TAX: "Tributo"
};

export const transactionTypeOptions = [
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "GOAL_CONTRIBUTION",
  "INVESTMENT",
  "LIABILITY_PAYMENT",
  "CREDIT_CARD_PURCHASE",
  "CREDIT_CARD_PAYMENT",
  "REFUND"
] as const;

export const transactionStatusOptions = ["CLEARED", "PLANNED", "PENDING", "OVERDUE"] as const;
export const paymentMethodOptions = [
  "PIX",
  "CASH",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "ACCOUNT_DEBIT",
  "BANK_SLIP",
  "TRANSFER",
  "OTHER"
] as const;
export const costNatureOptions = ["FIXED", "VARIABLE", "EXTRAORDINARY"] as const;
export const essentialityOptions = ["ESSENTIAL", "IMPORTANT", "SUPERFLUOUS", "IMPULSE"] as const;
export const accountTypeOptions = [
  "CHECKING",
  "SAVINGS",
  "CASH",
  "INVESTMENT",
  "WALLET",
  "BENEFIT",
  "OTHER"
] as const;
export const categoryDirectionOptions = ["INCOME", "EXPENSE", "SAVING", "DEBT"] as const;
export const budgetCadenceOptions = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;
export const goalKindOptions = [
  "EMERGENCY_FUND",
  "RETIREMENT",
  "TRAVEL",
  "EDUCATION",
  "HOME",
  "CAR",
  "RENOVATION",
  "CUSTOM"
] as const;
export const goalPriorityOptions = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export const assetTypeOptions = [
  "CASH",
  "INVESTMENT",
  "REAL_ESTATE",
  "VEHICLE",
  "BUSINESS",
  "OTHER"
] as const;
export const liabilityTypeOptions = [
  "CREDIT_CARD",
  "PERSONAL_LOAN",
  "MORTGAGE",
  "AUTO_LOAN",
  "FINANCING",
  "TAX",
  "OTHER"
] as const;

export const bankInstitutionCatalog = [
  { code: "001", name: "Banco do Brasil" },
  { code: "033", name: "Santander" },
  { code: "077", name: "Banco Inter" },
  { code: "104", name: "Caixa Economica Federal" },
  { code: "212", name: "Banco Original" },
  { code: "237", name: "Bradesco" },
  { code: "260", name: "Nubank" },
  { code: "290", name: "PagBank" },
  { code: "323", name: "Mercado Pago" },
  { code: "336", name: "C6 Bank" },
  { code: "341", name: "Itaú" },
  { code: "422", name: "Safra" },
  { code: "655", name: "Votorantim" },
  { code: "745", name: "Citibank" }
] as const;

export function humanizeEnum(value: string) {
  if (value === "INVESTMENT") {
    return "Investimento";
  }

  if (value === "INCOME") {
    return "Receita";
  }

  if (value === "EXPENSE") {
    return "Despesa";
  }

  if (value === "CASH") {
    return "Dinheiro";
  }

  return labels[value] ?? value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
