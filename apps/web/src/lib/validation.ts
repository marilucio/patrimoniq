const brlFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function maskCurrencyValue(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  const cents = Number(digits);
  if (!Number.isFinite(cents)) {
    return "";
  }
  return brlFormatter.format(cents / 100);
}

export function toCurrencyInputValue(
  value: number | string | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const numeric =
    typeof value === "number" ? value : parseAmountValue(String(value));
  if (numeric === null) {
    return "";
  }
  return brlFormatter.format(numeric);
}

function parseAmountValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") {
    return null;
  }
  const amount = Number(normalized);
  if (Number.isNaN(amount)) {
    return null;
  }
  return amount;
}

export function parseRequiredAmount(value: string, label: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {
      value: null,
      error: `${label} obrigatorio.`,
    };
  }

  const amount = parseAmountValue(trimmed);

  if (amount === null || amount < 0) {
    return {
      value: null,
      error: `${label} invalido.`,
    };
  }

  return {
    value: amount,
    error: null,
  };
}

export function parsePositiveAmount(value: string, label: string) {
  const parsed = parseRequiredAmount(value, label);

  if (parsed.error) {
    return parsed;
  }

  if ((parsed.value ?? 0) <= 0) {
    return {
      value: null,
      error: `${label} precisa ser maior que zero.`,
    };
  }

  return parsed;
}

export function validateIsoDate(value: string, label: string) {
  if (!value) {
    return `${label} obrigatoria.`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return `${label} invalida.`;
  }

  return null;
}

export function validateDateRange(start: string, end: string) {
  const startError = validateIsoDate(start, "Data inicial");
  if (startError) {
    return startError;
  }

  const endError = validateIsoDate(end, "Data final");
  if (endError) {
    return endError;
  }

  if (new Date(start) > new Date(end)) {
    return "A data final precisa ser maior ou igual a data inicial.";
  }

  return null;
}
