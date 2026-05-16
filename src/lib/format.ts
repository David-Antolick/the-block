// Display-layer formatting helpers. Per D005, all currency renders go through
// this module — never inline `$` or `${amount}` in JSX. Changing locale/code
// is a one-line edit to the CURRENCY constant below.

export const CURRENCY = {
  locale: 'en-CA',
  code: 'CAD',
} as const;

// Computed once at module load — Intl.NumberFormat construction isn't cheap
// and the formatter is reused across every card and panel render.
const currencyFormatter = new Intl.NumberFormat(CURRENCY.locale, {
  style: 'currency',
  currency: CURRENCY.code,
  maximumFractionDigits: 0,
});

const odometerFormatter = new Intl.NumberFormat(CURRENCY.locale, {
  maximumFractionDigits: 0,
});

/** Format a currency amount for display. Returns an em dash for null/undefined. */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return currencyFormatter.format(amount);
}

/** Format an odometer reading (km) with thousands separators and unit suffix. */
export function formatOdometer(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return '—';
  return `${odometerFormatter.format(km)} km`;
}
