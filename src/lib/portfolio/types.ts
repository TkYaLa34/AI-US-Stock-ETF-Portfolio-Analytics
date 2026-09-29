/**
 * Shared shapes for the portfolio / asset / transaction server actions, plus the
 * read models the dashboard passes from the server down to the client.
 *
 * This file deliberately has NO 'use server' directive, for the same reason as
 * src/lib/auth/types.ts: Next.js only allows a file to export async functions
 * when it does, and the INITIAL_* constants below are imported by Client
 * Components.
 *
 * IT IS ALSO THE CLIENT-SAFE HALF OF THE PORTFOLIO LAYER, and that is the reason
 * the read models live here rather than in queries.ts. queries.ts builds a
 * request-scoped Supabase client, which needs `cookies()` from next/headers;
 * a Client Component that reaches that module fails the build with
 * "You're importing a component that needs next/headers". Anything a Client
 * Component needs at RENDER time therefore has to be declared here, next to the
 * pure helpers - see the read models section at the bottom of this file.
 *
 * The values here are exactly the CHECK constraints in
 * 20260925000100_create_core_schema.sql. Keep the two in step: validation
 * exists to give a helpful message early, the constraint is what actually
 * holds the data honest.
 */

import type { AssetsRow } from '@/types/database.types';

/** Mirrors assets_type_allowed. */
export const ASSET_TYPES = [
  'stock',
  'etf',
  'mutual_fund',
  'bond',
  'reit',
  'crypto',
  'cash',
  'option',
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: 'หุ้น',
  etf: 'กองทุน ETF',
  mutual_fund: 'กองทุนรวม',
  bond: 'พันธบัตร',
  reit: 'ทรัพย์สินทางการเงิน (REIT)',
  crypto: 'คริปโต',
  cash: 'เงินสด',
  option: 'ออปชัน',
};

/** The subset of transactions_type_allowed that moves a position. */
export const TRADE_TYPES = ['BUY', 'SELL'] as const;
export type TradeType = (typeof TRADE_TYPES)[number];

export const TRADE_TYPE_LABELS: Record<TradeType, string> = {
  BUY: 'ซื้อ',
  SELL: 'ขาย',
};

/** The subset of transactions_type_allowed that only moves cash. */
export const CASH_TYPES = ['DEPOSIT', 'WITHDRAWAL'] as const;
export type CashType = (typeof CASH_TYPES)[number];

export const CASH_TYPE_LABELS: Record<CashType, string> = {
  DEPOSIT: 'ฝากเงินเข้า',
  WITHDRAWAL: 'ถอนเงินออก',
};

/** Every column value that is an ISO-4217 code must match this. */
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/** Mirrors assets_symbol_format: NYSE/BATS, class shares (BRK-B) and dots. */
export const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,14}$/;

/** Unambiguous enough to reject the string "not-a-uuid" before hitting the DB. */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PostgreSQL numeric(24,10) tolerates 10 decimal places. */
export const MAX_DECIMAL_PLACES = 10;

/** Postgres numeric(20,4) for portfolios.cash_balance. */
export const MAX_CASH_DECIMAL_PLACES = 4;

export const PORTFOLIO_NAME_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 500;
export const ASSET_NAME_MAX_LENGTH = 120;
export const NOTES_MAX_LENGTH = 1000;
export const EXCHANGE_MAX_LENGTH = 10;
export const SECTOR_MAX_LENGTH = 60;

/**
 * Every field any of the Phase 3 actions can complain about.
 *
 * One union for all three resources, mirroring how AuthActionState works, so a
 * single PortfolioActionState type can be passed around (and to useActionState)
 * without generics on every component.
 */
export type PortfolioField =
  // portfolios
  | 'name'
  | 'baseCurrency'
  | 'description'
  // assets
  | 'portfolioId'
  | 'symbol'
  | 'assetType'
  | 'exchange'
  | 'sector'
  | 'currency'
  | 'quantity'
  | 'averageCost'
  | 'currentPrice'
  // transactions
  | 'assetId'
  | 'transactionType'
  | 'price'
  | 'fees'
  | 'tradeDate'
  | 'amount'
  // shared
  | 'notes';

export type PortfolioFieldErrors = Partial<Record<PortfolioField, string>>;

export interface PortfolioActionState {
  status: 'idle' | 'error' | 'success';
  /** Human readable, already localised to Thai. */
  message: string | null;
  fieldErrors: PortfolioFieldErrors;
  /**
   * The raw Supabase error, already formatted for reading, or null when the
   * message above is specific enough or the detail is gated off.
   *
   * This is what turns an unactionable "บันทึกข้อมูลไม่สำเร็จ" into the actual
   * "42P01: relation \"portfolios\" does not exist", which is the whole point
   * when a migration has not been run. It is produced on the server by
   * toErrorDetail() in src/lib/portfolio/diagnostics.ts and rendered by <Alert>.
   */
  detail: string | null;
}

export const INITIAL_PORTFOLIO_ACTION_STATE: PortfolioActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
  detail: null,
};

/** Shorthand for "return this when the form is invalid". */
export function invalidState(
  fieldErrors: PortfolioFieldErrors,
  message = 'กรุณาตรวจสอบข้อมูลที่กรอก',
  detail: string | null = null,
): PortfolioActionState {
  return { status: 'error', message, fieldErrors, detail };
}

export function successState(message: string): PortfolioActionState {
  return { status: 'success', message, fieldErrors: {}, detail: null };
}

/**
 * A failure that is not tied to one field.
 *
 * `detail` is the raw database error. It is passed in rather than derived here
 * because this module is client safe: turning a PostgrestError into text needs
 * the env gate from src/lib/portfolio/diagnostics.ts, which only the server can
 * read correctly.
 */
export function failureState(
  message: string,
  detail: string | null = null,
): PortfolioActionState {
  return { status: 'error', message, fieldErrors: {}, detail };
}

// -----------------------------------------------------------------------------
// Read models
// -----------------------------------------------------------------------------

/*
 * The shapes the dashboard reads out of Postgres and hands to the Client
 * Components.
 *
 * They are plain, serialisable data with no Supabase client behind them, which
 * is what makes them safe to cross the server/client boundary: the server page
 * (src/app/dashboard/page.tsx) fetches and reduces the rows, and
 * DashboardShell receives finished props.
 */

/** PortfoliosRow narrowed to the columns the dashboard actually reads. */
export interface PortfolioListItem {
  id: string;
  name: string;
  description: string | null;
  base_currency: string;
  cash_balance: number;
  is_default: boolean;
  created_at: string;
}

/** The assets row as the forms and the positions table consume it. */
export type AssetListItem = AssetsRow;

/** A ledger row joined to the instrument it moved, for the activity feed. */
export interface TransactionListItem {
  id: string;
  transaction_type: string;
  quantity: number | null;
  price: number | null;
  total_amount: number;
  fees: number;
  trade_date: string;
  notes: string | null;
  assetSymbol: string | null;
  assetName: string | null;
}

/**
 * True when a ledger row is a cash movement rather than a trade.
 *
 * Pure and dependency free, so the activity feed can branch on it in the browser
 * without the row ever going back to the database. The two literals are the
 * cash-only members of the transactions_type_allowed CHECK constraint; the
 * activity feed relies on this to avoid labelling a DEPOSIT as a "ซื้อ".
 */
export function isCashTransaction(
  transaction: Pick<TransactionListItem, 'transaction_type'>,
): boolean {
  return (
    transaction.transaction_type === 'DEPOSIT' ||
    transaction.transaction_type === 'WITHDRAWAL'
  );
}
