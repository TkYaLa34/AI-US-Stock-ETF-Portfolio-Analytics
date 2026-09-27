/**
 * Display formatting helpers.
 *
 * Server and Client Components both import these, so there is nothing
 * environment specific in here. Values arrive as JS numbers because supabase-js
 * parses Postgres NUMERIC into a number; see the note at the top of
 * src/types/database.types.ts about why the authoritative arithmetic stays in
 * SQL. Everything here is presentation only.
 */

/** Formatters are expensive to build, and these run once per table row. */
const MONEY_CACHE = new Map<string, Intl.NumberFormat>();
const NUMBER_CACHE = new Map<string, Intl.NumberFormat>();

function getCachedFormatter(
  cache: Map<string, Intl.NumberFormat>,
  key: string,
  build: () => Intl.NumberFormat,
): Intl.NumberFormat {
  const existing = cache.get(key);
  if (existing) {
    return existing;
  }
  const created = build();
  cache.set(key, created);
  return created;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

/** e.g. 1234.5 USD -> "$1,234.50" */
export function formatMoney(value: number, currency: string): string {
  if (!isFiniteNumber(value)) {
    return '-';
  }

  const code = /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
  const formatter = getCachedFormatter(MONEY_CACHE, code, () =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  );

  return formatter.format(value);
}

/**
 * Signed money, for P&L. Always prefixed with + or - so the sign survives
 * being read out of context.
 */
export function formatSignedMoney(value: number, currency: string): string {
  if (!isFiniteNumber(value)) {
    return '-';
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatMoney(Math.abs(value), currency)}`;
}

/**
 * Share counts. Crypto needs 8dp, a rounded share count needs 0, and ETFs need
 * fractional shares - so trailing zeros are trimmed rather than hardcoding a
 * precision per instrument.
 */
export function formatQuantity(value: number): string {
  if (!isFiniteNumber(value)) {
    return '-';
  }

  const formatter = getCachedFormatter(NUMBER_CACHE, 'quantity', () =>
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    }),
  );

  return formatter.format(value);
}

/** e.g. 0.0734 -> "7.34%" */
export function formatPercent(value: number): string {
  if (!isFiniteNumber(value)) {
    return '-';
  }

  const formatter = getCachedFormatter(NUMBER_CACHE, 'percent', () =>
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  );

  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatter.format(Math.abs(value) * 100)}%`;
}

/**
 * formatPercent for the `number | null` that the analytics layer returns.
 *
 * A null percentage means "there is no cost basis to divide by" - a gifted or
 * transferred position, or one with no quote yet. Printing 0.00% there would
 * claim the holding is exactly break-even, which is a different statement.
 */
export function formatPercentOrDash(value: number | null): string {
  return value === null ? '-' : formatPercent(value);
}

/** e.g. 0.0734 -> "7.34%" (unsigned, for allocation bars). */
export function formatAllocationPercent(value: number): string {
  if (!isFiniteNumber(value)) {
    return '-';
  }

  const formatter = getCachedFormatter(NUMBER_CACHE, 'allocation', () =>
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  );

  return `${formatter.format(value * 100)}%`;
}

/**
 * `transactions.trade_date` is a Postgres DATE, which PostgREST serialises as
 * "YYYY-MM-DD". Parse it manually: `new Date("2026-09-26")` is UTC midnight,
 * which renders as the previous day for anyone west of Greenwich.
 */
export function formatDateOnly(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return isoDate;
  }

  const [, year, month, day] = match;
  if (year === undefined || month === undefined || day === undefined) {
    return isoDate;
  }

  return `${day}/${month}/${year}`;
}

/** Today's date as YYYY-MM-DD in the browser's local timezone. */
export function todayAsDateInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
