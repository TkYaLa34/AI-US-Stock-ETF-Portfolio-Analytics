/**
 * Server-only data access for the dashboard.
 *
 * Every query here runs through the request-scoped Supabase client, so RLS
 * applies: a user can only ever read their own rows. No service-role key is
 * used, and none of these functions accept a user id - the owner comes from the
 * session, never from the caller.
 *
 * Reads return `{ data, error }` rather than throwing, so the page can render a
 * partial dashboard with an inline error instead of a 500. Every failure is
 * logged here, in ./diagnostics, with the query that produced it - returning the
 * error to the page is not the same as recording it, and a silent failed read is
 * indistinguishable from an empty portfolio.
 *
 * THE READ MODELS ARE NOT DEFINED HERE. Because this module builds a Supabase
 * client it transitively imports `cookies` from next/headers, so a Client
 * Component that imports anything from it fails the build. PortfolioListItem,
 * AssetListItem, TransactionListItem and isCashTransaction are therefore declared
 * in ./types.ts and re-exported below, which keeps this file the single place
 * that knows about the database while leaving the browser bundle clean.
 */

import type { PostgrestError } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import type { AssetsRow } from '@/types/database.types';

import { buildPositionViews, type PositionView } from './analytics';
import { logSupabaseError, logThrownError } from './diagnostics';
import type {
  AssetListItem,
  PortfolioListItem,
  TransactionListItem,
} from './types';

export type {
  AssetListItem,
  PortfolioListItem,
  TransactionListItem,
} from './types';
export { isCashTransaction } from './types';

export interface QueryResult<T> {
  data: T;
  error: PostgrestError | null;
}

/*
 * THESE MUST STAY SINGLE STRING LITERALS - DO NOT SPLIT THEM WITH `+`.
 *
 * postgrest-js resolves the row type of `.select()` at the type level, by parsing
 * the literal text of the argument (GetResult, in select-query-parser/result). A
 * const assembled by string concatenation widens to `string`, the parser cannot
 * read that, and the query silently degrades to GenericStringError - so `data`
 * stops being `AssetsRow[]` and the build fails on an assignment that looks fine.
 * The long single lines below are load bearing, not sloppy formatting.
 */
const PORTFOLIO_COLUMNS =
  'id, name, description, base_currency, cash_balance, is_default, created_at';

const ASSET_COLUMNS =
  'id, portfolio_id, user_id, symbol, name, asset_type, exchange, sector, currency, quantity, average_cost, current_price, notes, created_at, updated_at';

const TRANSACTION_COLUMNS =
  'id, transaction_type, quantity, price, total_amount, fees, trade_date, notes, assets (symbol, name)';

/**
 * All of the user's portfolios, default first so the dashboard always has a
 * sensible fallback, then oldest first so the list does not reshuffle as new
 * portfolios are created.
 */
export async function listPortfolios(): Promise<QueryResult<PortfolioListItem[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('portfolios')
      .select(PORTFOLIO_COLUMNS)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      logSupabaseError('listPortfolios: select portfolios', error);
      return { data: [], error };
    }

    return { data: data ?? [], error: null };
  } catch (caught) {
    // A missing env var or a dead socket throws rather than returning an error.
    logThrownError('listPortfolios: select portfolios', caught);
    return { data: [], error: toFallbackError(caught) };
  }
}

/**
 * Picks which portfolio to display.
 *
 * A `?portfolio=` the caller cannot see is not worth an error banner - it is
 * either a stale bookmark or someone poking at the URL - so the default is used
 * instead. RLS has already guaranteed the list contains only their own rows.
 */
export function selectPortfolio(
  portfolios: readonly PortfolioListItem[],
  requestedId: string | null,
): PortfolioListItem | null {
  if (portfolios.length === 0) {
    return null;
  }

  if (requestedId) {
    const match = portfolios.find((portfolio) => portfolio.id === requestedId);
    if (match) {
      return match;
    }
  }

  return (
    portfolios.find((portfolio) => portfolio.is_default) ??
    portfolios[0] ??
    null
  );
}

export async function listPortfolioAssets(
  portfolioId: string,
): Promise<QueryResult<AssetListItem[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('assets')
      .select(ASSET_COLUMNS)
      .eq('portfolio_id', portfolioId)
      .order('symbol', { ascending: true });

    if (error) {
      logSupabaseError('listPortfolioAssets: select assets', error, {
        portfolioId,
      });
      return { data: [], error };
    }

    return { data: data ?? [], error: null };
  } catch (caught) {
    logThrownError('listPortfolioAssets: select assets', caught, { portfolioId });
    return { data: [], error: toFallbackError(caught) };
  }
}

/**
 * Everything the dashboard needs across portfolios in ONE round trip.
 *
 * The positions table and the summary only need the selected portfolio, but the
 * transaction form lets the user pick any portfolio, and a <select> cannot ask
 * the database a question. One `.in()` query for the whole set beats N queries
 * when switching the portfolio dropdown, and the payloads are tiny - a user
 * tracks tens of holdings, not millions.
 */
export async function listAssetsForPortfolios(
  portfolioIds: readonly string[],
): Promise<QueryResult<AssetListItem[]>> {
  if (portfolioIds.length === 0) {
    return { data: [], error: null };
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('assets')
      .select(ASSET_COLUMNS)
      .in('portfolio_id', [...portfolioIds])
      .order('symbol', { ascending: true });

    if (error) {
      logSupabaseError('listAssetsForPortfolios: select assets', error, {
        portfolioCount: portfolioIds.length,
      });
      return { data: [], error };
    }

    return { data: data ?? [], error: null };
  } catch (caught) {
    logThrownError('listAssetsForPortfolios: select assets', caught, {
      portfolioCount: portfolioIds.length,
    });
    return { data: [], error: toFallbackError(caught) };
  }
}

export async function listRecentTransactions(
  portfolioId: string,
  limit = 10,
): Promise<QueryResult<TransactionListItem[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('transactions')
      .select(TRANSACTION_COLUMNS)
      .eq('portfolio_id', portfolioId)
      .order('trade_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logSupabaseError('listRecentTransactions: select transactions', error, {
        portfolioId,
        limit,
      });
      return { data: [], error };
    }

    return { data: (data ?? []).map(toTransactionListItem), error: null };
  } catch (caught) {
    logThrownError('listRecentTransactions: select transactions', caught, {
      portfolioId,
      limit,
    });
    return { data: [], error: toFallbackError(caught) };
  }
}

interface EmbeddedAsset {
  symbol: string;
  name: string;
}

type EmbeddedAssetRelation = EmbeddedAsset[] | EmbeddedAsset | null;

/**
 * PostgREST inlines a to-one FK as an object, but supabase-js infers the type
 * from the generated `Relationships` entry, which describes the table rather
 * than this column's cardinality. Narrow defensively at runtime instead of
 * casting through `any` (forbidden by .clinerules section 1).
 */
function toTransactionListItem(row: {
  id: string;
  transaction_type: string;
  quantity: number | null;
  price: number | null;
  total_amount: number;
  fees: number;
  trade_date: string;
  notes: string | null;
  assets: unknown;
}): TransactionListItem {
  const relation = row.assets as EmbeddedAssetRelation;
  const asset = Array.isArray(relation) ? relation[0] : relation;

  return {
    id: row.id,
    transaction_type: row.transaction_type,
    quantity: row.quantity,
    price: row.price,
    total_amount: row.total_amount,
    fees: row.fees,
    trade_date: row.trade_date,
    notes: row.notes,
    assetSymbol: asset?.symbol ?? null,
    assetName: asset?.name ?? null,
  };
}

/** Convenience wrapper: assets plus their derived market values. */
export function toPositionViews(assets: readonly AssetListItem[]): PositionView[] {
  return buildPositionViews(assets);
}

/**
 * Wraps a thrown error (a missing env var, a dead socket) in the shape the page
 * already knows how to render.
 */
function toFallbackError(error: unknown): PostgrestError {
  const message =
    error instanceof Error
      ? error.message
      : 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล';

  /*
   * Only the four own properties are required. `name` and `message` are already
   * satisfied structurally because PostgrestError extends Error, and there is no
   * `toJSON` on it in supabase-js 2.47 / postgrest-js 1.17 - adding one is an
   * excess property error, not a compatible extension.
   */
  return {
    code: 'CONNECTION_ERROR',
    details: '',
    hint: '',
    message,
    name: 'ConnectionError',
  };
}

