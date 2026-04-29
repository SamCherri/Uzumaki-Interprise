export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPrice(value: number) {
  if (!Number.isFinite(value)) return '0,00';

  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

export function formatSignedPrice(value: number) {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${formatPrice(Math.abs(value))}`;
}

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';

  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
