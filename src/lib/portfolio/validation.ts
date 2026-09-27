/**
 * Server side validation for the portfolio, asset and transaction forms.
 *
 * Every rule is re-checked here even though the inputs are also constrained in
 * the browser. Client validation is a UX affordance only - a request can
 * arrive from anywhere, so this is the real gate. The Postgres CHECK
 * constraints remain the final authority; this layer exists to turn a 23514
 * into a sentence the user can act on.
 *
 * The patterns are imported from ./types so they cannot drift from the
 * constraints declared in 20260925000100_create_core_schema.sql.
 *
 * Every validator returns `{ fieldErrors, values }`. `values` is null when
 * anything failed, so a caller can never half-apply a form: the actions check
 * `if (!values)` before touching the database.
 */

import {
  ASSET_NAME_MAX_LENGTH,
  CASH_TYPES,
  CURRENCY_PATTERN,
  DESCRIPTION_MAX_LENGTH,
  EXCHANGE_MAX_LENGTH,
  MAX_CASH_DECIMAL_PLACES,
  MAX_DECIMAL_PLACES,
  NOTES_MAX_LENGTH,
  PORTFOLIO_NAME_MAX_LENGTH,
  SECTOR_MAX_LENGTH,
  SYMBOL_PATTERN,
  TRADE_TYPES,
  UUID_PATTERN,
  type CashType,
  type PortfolioFieldErrors,
  type TradeType,
} from './types';

/**
 * Deliberately stricter than Number(): rejects '1,234.50', '1e5', '0x10',
 * 'Infinity', '' and whitespace, none of which Postgres NUMERIC accepts.
 */
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function readField(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

/** Empty string means "not provided / leave unchanged". */
function readOptional(formData: FormData, field: string): string | null {
  const value = readField(formData, field);
  return value === '' ? null : value;
}

/**
 * Returns null for a blank field so the caller can decide whether that is
 * allowed, and NaN for a present-but-unparseable one.
 */
function readDecimal(formData: FormData, field: string): number | null {
  const raw = readField(formData, field);
  if (raw === '') {
    return null;
  }
  if (!DECIMAL_PATTERN.test(raw)) {
    return Number.NaN;
  }
  return Number(raw);
}

function decimalPlaces(raw: string): number {
  const dotIndex = raw.indexOf('.');
  return dotIndex === -1 ? 0 : raw.length - dotIndex - 1;
}

function hasErrors(fieldErrors: PortfolioFieldErrors): boolean {
  return Object.keys(fieldErrors).length > 0;
}

/**
 * Rejects a raw string that NUMERIC(x,y) would round rather than store, so the
 * user finds out now instead of watching their quantity quietly change.
 */
function validateDecimalField(
  formData: FormData,
  field: keyof PortfolioFieldErrors,
  label: string,
  maxPlaces: number,
  options: { min?: number; exclusiveMin?: boolean; allowBlank: boolean },
  fieldErrors: PortfolioFieldErrors,
): number | null {
  const raw = readField(formData, field);
  const value = readDecimal(formData, field);

  if (value === null) {
    if (!options.allowBlank) {
      fieldErrors[field] = `กรุณากรอก${label}`;
    }
    return null;
  }

  if (Number.isNaN(value)) {
    fieldErrors[field] = `${label}ต้องเป็นตัวเลขที่ถูกต้อง`;
    return null;
  }

  if (options.exclusiveMin === true && value <= 0) {
    fieldErrors[field] = `${label}ต้องมากกว่า 0`;
    return null;
  }
  if (options.min !== undefined && value < options.min) {
    fieldErrors[field] = `${label}ต้องไม่น้อยกว่า ${options.min}`;
    return null;
  }

  if (decimalPlaces(raw) > maxPlaces) {
    fieldErrors[field] = `${label}รองรับทศนิยมไม่เกิน ${maxPlaces} ตำแหน่ง`;
    return null;
  }

  return value;
}

function validateCurrency(
  formData: FormData,
  field: 'baseCurrency' | 'currency',
  label: string,
  required: boolean,
  fieldErrors: PortfolioFieldErrors,
): string | null {
  const raw = readField(formData, field).toUpperCase();

  if (raw === '') {
    if (required) {
      fieldErrors[field] = `กรุณากรอก${label}`;
    }
    return null;
  }

  if (!CURRENCY_PATTERN.test(raw)) {
    fieldErrors[field] =
      `${label}ต้องเป็นรหัสสกุลเงิน 3 ตัวอักษรภาษาอังกฤษ เช่น USD`;
    return null;
  }

  return raw;
}

function validateUuid(
  formData: FormData,
  field: 'portfolioId' | 'assetId',
  label: string,
  fieldErrors: PortfolioFieldErrors,
): string | null {
  const raw = readField(formData, field);

  if (raw === '') {
    fieldErrors[field] = `กรุณาเลือก${label}`;
    return null;
  }

  if (!UUID_PATTERN.test(raw)) {
    fieldErrors[field] = `ไม่พบ${label}ที่ถูกต้อง`;
    return null;
  }

  return raw;
}

function validateLength(
  formData: FormData,
  field: keyof PortfolioFieldErrors,
  label: string,
  maxLength: number,
  options: { required: boolean },
  fieldErrors: PortfolioFieldErrors,
): string | null {
  const raw = readField(formData, field);

  if (raw === '') {
    if (options.required) {
      fieldErrors[field] = `กรุณากรอก${label}`;
    }
    return null;
  }

  if (raw.length > maxLength) {
    fieldErrors[field] = `${label}ต้องไม่เกิน ${maxLength} ตัวอักษร`;
    return null;
  }

  return raw;
}

// -----------------------------------------------------------------------------
// portfolios
// -----------------------------------------------------------------------------

export interface PortfolioInput {
  name: string;
  description: string | null;
  baseCurrency: string;
}

export function validatePortfolio(formData: FormData): {
  fieldErrors: PortfolioFieldErrors;
  values: PortfolioInput | null;
} {
  const fieldErrors: PortfolioFieldErrors = {};

  const name = validateLength(
    formData,
    'name',
    'ชื่อพอร์ตโฟลิโอ',
    PORTFOLIO_NAME_MAX_LENGTH,
    { required: true },
    fieldErrors,
  );

  const description = validateLength(
    formData,
    'description',
    'รายละเอียด',
    DESCRIPTION_MAX_LENGTH,
    { required: false },
    fieldErrors,
  );

  const baseCurrency = validateCurrency(
    formData,
    'baseCurrency',
    'สกุลเงินหลัก',
    true,
    fieldErrors,
  );

  if (hasErrors(fieldErrors) || name === null || baseCurrency === null) {
    return { fieldErrors, values: null };
  }

  return { fieldErrors, values: { name, description, baseCurrency } };
}

/**
 * Identifies which portfolio to mutate. Kept separate from validatePortfolio so
 * a bad id is reported on its own, before any field errors.
 */
export function validatePortfolioId(formData: FormData): string | null {
  const fieldErrors: PortfolioFieldErrors = {};
  const id = validateUuid(formData, 'portfolioId', 'พอร์ตโฟลิโอ', fieldErrors);
  return hasErrors(fieldErrors) ? null : id;
}

// -----------------------------------------------------------------------------
// assets
// -----------------------------------------------------------------------------

export interface AssetInput {
  portfolioId: string;
  symbol: string;
  name: string;
  assetType: string;
  exchange: string | null;
  sector: string | null;
  currency: string;
  quantity: number;
  averageCost: number;
  currentPrice: number | null;
  notes: string | null;
}

export function validateAsset(formData: FormData): {
  fieldErrors: PortfolioFieldErrors;
  values: AssetInput | null;
} {
  const fieldErrors: PortfolioFieldErrors = {};

  const portfolioId = validateUuid(
    formData,
    'portfolioId',
    'พอร์ตโฟลิโอ',
    fieldErrors,
  );

  // Tickers are case insensitive in practice: "aapl" and "AAPL" are the same
  // instrument, and assets_symbol_format only accepts upper case.
  const symbol = readField(formData, 'symbol').toUpperCase();
  if (symbol === '') {
    fieldErrors.symbol = 'กรุณากรอกรหัสหลักทรัพย์';
  } else if (!SYMBOL_PATTERN.test(symbol)) {
    fieldErrors.symbol =
      'รหัสต้องเป็นตัวอักษร/ตัวเลขภาษาอังกฤษ ขึ้นต้นด้วยตัวอักษรหรือตัวเลข และยาวไม่เกิน 15 ตัว (เช่น AAPL, BRK-B, BRK.B)';
  }

  const name = validateLength(
    formData,
    'name',
    'ชื่อหลักทรัพย์',
    ASSET_NAME_MAX_LENGTH,
    { required: true },
    fieldErrors,
  );

  const assetType = readField(formData, 'assetType');
  if (assetType === '') {
    fieldErrors.assetType = 'กรุณาเลือกประเภทหลักทรัพย์';
  }

  const exchange = readOptional(formData, 'exchange');
  if (exchange !== null) {
    if (exchange.length > EXCHANGE_MAX_LENGTH) {
      fieldErrors.exchange = `ตลาดต้องไม่เกิน ${EXCHANGE_MAX_LENGTH} ตัวอักษร`;
    } else if (!/^[A-Za-z0-9.\- ]+$/.test(exchange)) {
      fieldErrors.exchange = 'ตลาดต้องเป็นตัวอักษรหรือตัวเลขเท่านั้น';
    }
  }

  const sector = readOptional(formData, 'sector');
  if (sector !== null && sector.length > SECTOR_MAX_LENGTH) {
    fieldErrors.sector = `กลุ่มอุตสาหกรรมต้องไม่เกิน ${SECTOR_MAX_LENGTH} ตัวอักษร`;
  }

  const currency = validateCurrency(
    formData,
    'currency',
    'สกุลเงิน',
    true,
    fieldErrors,
  );

  const quantity = validateDecimalField(
    formData,
    'quantity',
    'จำนวนหุ้น/หน่วย',
    MAX_DECIMAL_PLACES,
    { min: 0, allowBlank: false },
    fieldErrors,
  );

  const averageCost = validateDecimalField(
    formData,
    'averageCost',
    'ต้นทุนต่อหน่วย',
    MAX_DECIMAL_PLACES,
    { min: 0, allowBlank: false },
    fieldErrors,
  );

  const currentPrice = validateDecimalField(
    formData,
    'currentPrice',
    'ราคาปัจจุบัน',
    MAX_DECIMAL_PLACES,
    { min: 0, allowBlank: true },
    fieldErrors,
  );

  const notes = validateLength(
    formData,
    'notes',
    'หมายเหตุ',
    NOTES_MAX_LENGTH,
    { required: false },
    fieldErrors,
  );

  if (
    hasErrors(fieldErrors) ||
    portfolioId === null ||
    name === null ||
    currency === null ||
    quantity === null ||
    averageCost === null
  ) {
    return { fieldErrors, values: null };
  }

  return {
    fieldErrors,
    values: {
      portfolioId,
      symbol,
      name,
      // Reached only when a value from ASSET_TYPES made it this far; the CHECK
      // constraint assets_type_allowed is what actually guarantees it.
      assetType,
      exchange: exchange?.toUpperCase() ?? null,
      sector,
      currency,
      quantity,
      averageCost,
      currentPrice,
      notes,
    },
  };
}

/** The row id is only needed by the update / delete paths. */
export function validateAssetId(formData: FormData): string | null {
  const fieldErrors: PortfolioFieldErrors = {};
  const id = validateUuid(formData, 'assetId', 'หลักทรัพย์', fieldErrors);
  return hasErrors(fieldErrors) ? null : id;
}

// -----------------------------------------------------------------------------
// transactions: BUY / SELL
// -----------------------------------------------------------------------------

export interface TradeInput {
  portfolioId: string;
  assetId: string;
  transactionType: TradeType;
  quantity: number;
  price: number;
  fees: number;
  tradeDate: string;
  notes: string | null;
}

/**
 * `transactions_settled_after_trade` only compares two columns, so the database
 * would happily accept a trade_date in the future. It is refused here because a
 * trade that has not happened yet cannot be recorded.
 */
function validateTradeDate(
  formData: FormData,
  fieldErrors: PortfolioFieldErrors,
): string | null {
  const raw = readField(formData, 'tradeDate');

  if (raw === '') {
    fieldErrors.tradeDate = 'กรุณาเลือกวันที่ทำรายการ';
    return null;
  }

  if (!DATE_PATTERN.test(raw)) {
    fieldErrors.tradeDate = 'รูปแบบวันที่ไม่ถูกต้อง';
    return null;
  }

  // Read the parts and build a UTC date rather than passing the bare
  // "YYYY-MM-DD" to new Date(), which is UTC midnight and therefore renders as
  // the previous day anywhere west of Greenwich.
  const parts = raw.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) {
    fieldErrors.tradeDate = 'รูปแบบวันที่ไม่ถูกต้อง';
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  if (!isRealDate) {
    fieldErrors.tradeDate = 'วันที่ไม่ถูกต้อง';
    return null;
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (parsed.getTime() > todayUtc) {
    fieldErrors.tradeDate = 'วันที่ทำรายการต้องไม่เกินวันนี้';
    return null;
  }

  return raw;
}

export function validateTrade(formData: FormData): {
  fieldErrors: PortfolioFieldErrors;
  values: TradeInput | null;
} {
  const fieldErrors: PortfolioFieldErrors = {};

  const portfolioId = validateUuid(
    formData,
    'portfolioId',
    'พอร์ตโฟลิโอ',
    fieldErrors,
  );
  const assetId = validateUuid(formData, 'assetId', 'หลักทรัพย์', fieldErrors);

  const rawType = readField(formData, 'transactionType');
  const transactionType = TRADE_TYPES.find((type) => type === rawType);
  if (transactionType === undefined) {
    fieldErrors.transactionType = 'กรุณาเลือกประเภทรายการ (ซื้อ หรือ ขาย)';
  }

  // transactions_trade_fields demands quantity > 0 and price > 0 for a trade.
  const quantity = validateDecimalField(
    formData,
    'quantity',
    'จำนวน',
    MAX_DECIMAL_PLACES,
    { exclusiveMin: true, allowBlank: false },
    fieldErrors,
  );
  const price = validateDecimalField(
    formData,
    'price',
    'ราคา',
    MAX_DECIMAL_PLACES,
    { exclusiveMin: true, allowBlank: false },
    fieldErrors,
  );
  const fees = validateDecimalField(
    formData,
    'fees',
    'ค่าธรรมเนียม',
    MAX_DECIMAL_PLACES,
    { min: 0, allowBlank: true },
    fieldErrors,
  );

  const tradeDate = validateTradeDate(formData, fieldErrors);

  const notes = validateLength(
    formData,
    'notes',
    'หมายเหตุ',
    NOTES_MAX_LENGTH,
    { required: false },
    fieldErrors,
  );

  if (
    hasErrors(fieldErrors) ||
    portfolioId === null ||
    assetId === null ||
    transactionType === undefined ||
    quantity === null ||
    price === null ||
    tradeDate === null
  ) {
    return { fieldErrors, values: null };
  }

  return {
    fieldErrors,
    values: {
      portfolioId,
      assetId,
      transactionType,
      quantity,
      price,
      // A blank fee is a zero fee, not an error.
      fees: fees ?? 0,
      tradeDate,
      notes,
    },
  };
}

// -----------------------------------------------------------------------------
// transactions: DEPOSIT / WITHDRAWAL
// -----------------------------------------------------------------------------

export interface CashMovementInput {
  portfolioId: string;
  transactionType: CashType;
  amount: number;
  notes: string | null;
}

/**
 * DEPOSIT / WITHDRAWAL move portfolios.cash_balance and nothing else, so the
 * rules are a subset of validateTrade's: no asset, no quantity, no price.
 *
 * MAX_CASH_DECIMAL_PLACES is used rather than MAX_DECIMAL_PLACES because the
 * balance it has to land in is numeric(20,4) - a tenth of a satoshi would be
 * silently rounded by the column, so the form refuses it up front instead.
 */
export function validateCashMovement(formData: FormData): {
  fieldErrors: PortfolioFieldErrors;
  values: CashMovementInput | null;
} {
  const fieldErrors: PortfolioFieldErrors = {};

  const portfolioId = validateUuid(
    formData,
    'portfolioId',
    'พอร์ตโฟลิโอ',
    fieldErrors,
  );

  const rawType = readField(formData, 'transactionType');
  const transactionType = CASH_TYPES.find((type) => type === rawType);
  if (transactionType === undefined) {
    fieldErrors.transactionType =
      'กรุณาเลือกประเภทรายการ (ฝากเงินเข้า หรือ ถอนเงินออก)';
  }

  const amount = validateDecimalField(
    formData,
    'amount',
    'จำนวนเงิน',
    MAX_CASH_DECIMAL_PLACES,
    { exclusiveMin: true, allowBlank: false },
    fieldErrors,
  );

  const notes = validateLength(
    formData,
    'notes',
    'หมายเหตุ',
    NOTES_MAX_LENGTH,
    { required: false },
    fieldErrors,
  );

  if (
    hasErrors(fieldErrors) ||
    portfolioId === null ||
    transactionType === undefined ||
    amount === null
  ) {
    return { fieldErrors, values: null };
  }

  return {
    fieldErrors,
    values: {
      portfolioId,
      transactionType,
      amount,
      notes,
    },
  };
}
