export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPrice(value: number) {
  if (!Number.isFinite(value)) return '0,00';

  const absValue = Math.abs(value);
  const options =
    absValue >= 1
      ? { minimumFractionDigits: 2, maximumFractionDigits: 4 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 8 };

  return value.toLocaleString('pt-BR', options);
}
