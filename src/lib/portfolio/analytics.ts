/**
 * Pure portfolio maths for the dashboard.
 *
 * Deliberately dependency free and synchronous: it takes plain numbers and
 * returns plain numbers, which keeps it trivially testable and usable from
 * either a Server or a Client Component.
 *
 * PRECISION: this is display arithmetic. The authoritative position, cost basis
 * and cash balance are maintained by the SQL in
 * 20260926000100_create_portfolio_functions.sql, using NUMERIC end to end.
 * Summing a few hundred floats to render a chart cannot drift in a way a human
 * would notice, and the same values in SQL would cost a round trip per card.
 */

import type { AssetsRow } from '@/types/database.types';

import { ASSET_TYPES, ASSET_TYPE_LABELS } from './types';

/** A holding plus the two derived numbers the table and cards both need. */
export interface PositionView {
  asset: AssetsRow;
  /** quantity * (current_price ?? average_cost) */
  marketValue: number;
  /** quantity * average_cost */
  costBasis: number;
  /** marketValue - costBasis */
  unrealizedPnl: number;
  /**
   * null when the position has no cost basis at all (a gift or a transfer), or
   * when there is no current price to compare against. Rendering "0%" there
   * would be a lie.
   */
  unrealizedPnlPercent: number | null;
  /** true when current_price is populated, i.e. the P&L is not just cost. */
  hasMarketPrice: boolean;
}

export interface PortfolioSummary {
  currency: string;
  cashBalance: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number | null;
  /** marketValue + cashBalance */
  totalValue: number;
  positionCount: number;
  /** Positions that have a current_price and therefore a real valuation. */
  valuedPositionCount: number;
}

export interface AllocationSlice {
  key: string;
  label: string;
  marketValue: number;
  /** 0..1, of the sum of the slices. Zero when the total is zero. */
  percent: number;
}

const UNKNOWN_SECTOR_KEY = '__none__';
const UNKNOWN_SECTOR_LABEL = 'ไม่ระบุกลุ่มอุตสาหกรรม';

/** The fallback price when a quote has never been fetched. */
function unitValue(asset: AssetsRow): number {
  return asset.current_price ?? asset.average_cost;
}

export function buildPositionViews(assets: readonly AssetsRow[]): PositionView[] {
  return assets.map((asset) => {
    const marketValue = asset.quantity * unitValue(asset);
    const costBasis = asset.quantity * asset.average_cost;
    const unrealizedPnl = marketValue - costBasis;

    // Percentages are only meaningful against a non-zero cost basis.
    const unrealizedPnlPercent = costBasis > 0 ? unrealizedPnl / costBasis : null;

    return {
      asset,
      marketValue,
      costBasis,
      unrealizedPnl,
      unrealizedPnlPercent,
      hasMarketPrice: asset.current_price !== null,
    };
  });
}

export function summarisePortfolio(
  positions: readonly PositionView[],
  cashBalance: number,
  currency: string,
): PortfolioSummary {
  let marketValue = 0;
  let costBasis = 0;
  let valuedPositionCount = 0;

  for (const position of positions) {
    marketValue += position.marketValue;
    costBasis += position.costBasis;
    if (position.hasMarketPrice) {
      valuedPositionCount += 1;
    }
  }

  const unrealizedPnl = marketValue - costBasis;

  return {
    currency,
    cashBalance,
    marketValue,
    costBasis,
    unrealizedPnl,
    unrealizedPnlPercent: costBasis > 0 ? unrealizedPnl / costBasis : null,
    totalValue: marketValue + cashBalance,
    positionCount: positions.length,
    valuedPositionCount,
  };
}

/**
 * Allocation by asset type, largest first.
 *
 * Only the schema's own asset_type values are emitted, so the bar chart cannot
 * drift out of sync with the CHECK constraint; an unknown type from a future
 * migration is bucketed under the "other" label rather than crashing the page.
 */
export function allocationByAssetType(
  positions: readonly PositionView[],
): AllocationSlice[] {
  const knownTypes = new Set<string>(ASSET_TYPES);
  const totals = new Map<string, number>();

  for (const position of positions) {
    const key = knownTypes.has(position.asset.asset_type)
      ? position.asset.asset_type
      : '__other__';
    totals.set(key, (totals.get(key) ?? 0) + position.marketValue);
  }

  return toSortedSlices(totals);
}

/** Allocation by sector, with an explicit bucket for assets that have none. */
export function allocationBySector(
  positions: readonly PositionView[],
): AllocationSlice[] {
  const totals = new Map<string, number>();

  for (const position of positions) {
    const sector = position.asset.sector?.trim();
    const key = sector ? sector : UNKNOWN_SECTOR_KEY;
    totals.set(key, (totals.get(key) ?? 0) + position.marketValue);
  }

  return toSortedSlices(totals);
}

function toSortedSlices(totals: ReadonlyMap<string, number>): AllocationSlice[] {
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);

  return [...totals.entries()]
    .map(([key, marketValue]) => ({
      key,
      label: labelForAllocationKey(key),
      marketValue,
      percent: total > 0 ? marketValue / total : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);
}

function labelForAllocationKey(key: string): string {
  if (key === UNKNOWN_SECTOR_KEY) {
    return UNKNOWN_SECTOR_LABEL;
  }
  if (key === '__other__') {
    return 'อื่นๆ';
  }

  // Reuse the single label map the asset form renders, so a type renamed in one
  // place cannot be stale in the other.
  const assetType = ASSET_TYPES.find((type) => type === key);
  return assetType ? ASSET_TYPE_LABELS[assetType] : key;
}
