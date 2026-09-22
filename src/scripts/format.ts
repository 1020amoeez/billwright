/** Number parsing and formatting. Invoices print the currency code, per the design. */

/** Locale used for grouping. Set from the chosen currency's country. */
const localeFor: Record<string, string> = {
  PKR: 'en-PK',
  AED: 'en-AE',
  GBP: 'en-GB',
  INR: 'en-IN',
  SAR: 'en-SA',
  AUD: 'en-AU',
  CAD: 'en-CA',
  USD: 'en-US',
};

/** Reads a user-typed amount. Tolerates thousands separators and stray spaces. */
export function parseAmount(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** 4500 -> "4,500.00" */
export function formatAmount(n: number, currency = 'PKR'): string {
  return new Intl.NumberFormat(localeFor[currency] ?? 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

/** 4500 -> "PKR 4,500.00" */
export function formatMoney(n: number, currency = 'PKR'): string {
  return `${currency} ${formatAmount(n, currency)}`;
}

/** Quantities keep whatever precision the user typed, up to 2 places. */
export function formatQty(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
}

/** 12.3456 -> "12.3%" */
export function formatPercent(n: number, places = 1): string {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(places)}%`;
}

/** Plain number for calculator results: "72,000" or "1,234.56" */
export function formatNumber(n: number, places = 2): string {
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 100) / 100;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : places,
    maximumFractionDigits: places,
  }).format(rounded);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "2026-10-12" -> "12 Oct 2026". Written out rather than left to Intl, which
 * renders September as "Sept" and the design uses "Sep".
 * Passes through anything it cannot parse.
 */
export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
