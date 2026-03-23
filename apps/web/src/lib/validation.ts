export function parseRequiredAmount(value: string, label: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {
      value: null,
      error: `${label} obrigatorio.`
    };
  }

  const amount = Number(trimmed);

  if (Number.isNaN(amount) || amount < 0) {
    return {
      value: null,
      error: `${label} invalido.`
    };
  }

  return {
    value: amount,
    error: null
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
      error: `${label} precisa ser maior que zero.`
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
