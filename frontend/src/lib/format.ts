export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

export function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatNumber(value: number) {
  return numberFormatter.format(value || 0);
}
