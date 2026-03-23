import type { GoalProgressInput } from "../types";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2
});

const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0
});

export function calculateGoalProgress(goal: GoalProgressInput): number {
  if (!goal.targetAmount || goal.targetAmount <= 0) {
    return 0;
  }

  return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
}

export function formatCurrency(value: number): string {
  return currency.format(value ?? 0);
}

export function formatPercent(value: number): string {
  return percent.format(value ?? 0);
}
