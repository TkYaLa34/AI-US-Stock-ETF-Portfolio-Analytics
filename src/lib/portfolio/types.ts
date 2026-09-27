/**
 * Shared shapes for the portfolio / asset / transaction server actions.
 *
 * This file deliberately has NO 'use server' directive, for the same reason as
 * src/lib/auth/types.ts: Next.js only allows a file to export async functions
 * when it does, and the INITIAL_* constants below are imported by Client
 * Components.
 *
 * The values here are exactly the CHECK constraints in
 * 20260925000100_create_core_schema.sql. Keep the two in step: validation
 * exists to give a helpful message early, the constraint is what actually
 * holds the data honest.
 */

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
}

export const INITIAL_PORTFOLIO_ACTION_STATE: PortfolioActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
};

/** Shorthand for "return this when the form is invalid". */
export function invalidState(
  fieldErrors: PortfolioFieldErrors,
  message = 'กรุณาตรวจสอบข้อมูลที่กรอก',
): PortfolioActionState {
  return { status: 'error', message, fieldErrors };
}

export function successState(message: string): PortfolioActionState {
  return { status: 'success', message, fieldErrors: {} };
}

export function failureState(message: string): PortfolioActionState {
  return { status: 'error', message, fieldErrors: {} };
}
