// Per D005, all currency renders go through this module — never inline `$`
// in JSX. Changing locale/code is a one-line edit to the CURRENCY constant.

export const CURRENCY = {
  locale: 'en-CA',
  code: 'CAD',
} as const;

const currencyFormatter = new Intl.NumberFormat(CURRENCY.locale, {
  style: 'currency',
  currency: CURRENCY.code,
  maximumFractionDigits: 0,
});

const odometerFormatter = new Intl.NumberFormat(CURRENCY.locale, {
  maximumFractionDigits: 0,
});

/** Format currency. Em dash for null/undefined. */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return currencyFormatter.format(amount);
}

/** Format odometer (km) with thousands separators. */
export function formatOdometer(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return '—';
  return `${odometerFormatter.format(km)} km`;
}
