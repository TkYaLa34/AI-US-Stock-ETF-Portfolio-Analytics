'use server';

/**
 * Asset CRUD server actions.
 *
 * Same contract as the portfolio actions: (previousState, formData) in,
 * serialisable PortfolioActionState out, revalidate on success. See
 * src/app/actions/portfolio-actions.ts for the full rationale.
 *
 * NOTE ON DELETING A POSITION: removing an asset also cascades away its ledger
 * rows (transactions.asset_id is on delete cascade), but the cash its sales
 * produced stays in the portfolio. That is deliberate for Phase 3 - the ledger
 * is append only from the UI, and a mistake is corrected by recording an
 * offsetting trade rather than by rewriting history.
 */

import type { PostgrestError } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/require-user';
import { DASHBOARD_PATH } from '@/lib/portfolio/constants';
import {
  GENERIC_WRITE_ERROR_MESSAGE,
  isUniqueViolation,
  toWriteErrorMessage,
  uniqueViolationColumns,
} from '@/lib/portfolio/errors';
import {
  failureState,
  invalidState,
  successState,
  type PortfolioActionState,
} from '@/lib/portfolio/types';
import { validateAsset, validateAssetId } from '@/lib/portfolio/validation';
import { createClient } from '@/lib/supabase/server';

/**
 * assets_portfolio_symbol_uidx is a unique index on (portfolio_id, symbol).
 * Point the duplicate at the symbol input rather than leaking the index name.
 */
function duplicateSymbolState(error: PostgrestError): PortfolioActionState {
  if (
    isUniqueViolation(error) &&
    uniqueViolationColumns(error).includes('symbol')
  ) {
    return invalidState({
      symbol: 'มีหลักทรัพย์รหัสนี้อยู่ในพอร์ตโฟลิโอนี้แล้ว',
    });
  }

  return failureState(toWriteErrorMessage(error));
}

export async function createAssetAction(
  _previousState: PortfolioActionState,
  formData: FormData,
): Promise<PortfolioActionState> {
  // OUTSIDE the try/catch: redirect() throws, and must not be swallowed.
  const user = await requireUser(DASHBOARD_PATH);

  const { fieldErrors, values } = validateAsset(formData);
  if (!values) {
    return invalidState(fieldErrors);
  }

  try {
    const supabase = await createClient();

    /*
     * user_id is sent from the session, not from the form, and the
     * assets_derive_user_id trigger re-derives it from the parent portfolio
     * anyway. RLS assets_insert_own still has to pass, which is what stops a
     * caller from planting an asset inside somebody else's portfolio.
     */
    const { error } = await supabase.from('assets').insert({
      portfolio_id: values.portfolioId,
      user_id: user.id,
      symbol: values.symbol,
      name: values.name,
      asset_type: values.assetType,
      exchange: values.exchange,
      sector: values.sector,
      currency: values.currency,
      quantity: values.quantity,
      average_cost: values.averageCost,
      current_price: values.currentPrice,
      notes: values.notes,
    });

    if (error) {
      return duplicateSymbolState(error);
    }
  } catch {
    return failureState(GENERIC_WRITE_ERROR_MESSAGE);
  }

  revalidatePath(DASHBOARD_PATH);
  return successState(`เพิ่มหลักทรัพย์ ${values.symbol} เรียบร้อยแล้ว`);
}

export async function updateAssetAction(
  _previousState: PortfolioActionState,
  formData: FormData,
): Promise<PortfolioActionState> {
  // See createAssetAction: the redirect must escape the try/catch below.
  const user = await requireUser(DASHBOARD_PATH);

  const assetId = validateAssetId(formData);
  if (!assetId) {
    return failureState('ไม่พบหลักทรัพย์ที่ต้องการแก้ไข');
  }

  const { fieldErrors, values } = validateAsset(formData);
  if (!values) {
    return invalidState(fieldErrors);
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('assets')
      .update({
        // The symbol is editable, but a ticker still has to be unique per
        // portfolio, so a clash is reported exactly as it is on create.
        symbol: values.symbol,
        name: values.name,
        asset_type: values.assetType,
        exchange: values.exchange,
        sector: values.sector,
        currency: values.currency,
        quantity: values.quantity,
        average_cost: values.averageCost,
        current_price: values.currentPrice,
        notes: values.notes,
      })
      .eq('id', assetId)
      .select('id');

    if (error) {
      return duplicateSymbolState(error);
    }

    // RLS filtered the update: no rows means "not yours, or already deleted".
    if (!data || data.length === 0) {
      return failureState('ไม่พบหลักทรัพย์ที่ต้องการแก้ไข');
    }
  } catch {
    return failureState(GENERIC_WRITE_ERROR_MESSAGE);
  }

  revalidatePath(DASHBOARD_PATH);
  return successState(`บันทึกการแก้ไขหลักทรัพย์ ${values.symbol} เรียบร้อยแล้ว`);
}

/**
 * `portfolio_id` is deliberately NOT editable here.
 *
 * Moving an asset between portfolios would invalidate the trades already
 * recorded against it, and the ledger rows would have to move with it. That is
 * a transfer, not an edit, and it is out of scope for Phase 3.
 */
export async function deleteAssetAction(
  _previousState: PortfolioActionState,
  formData: FormData,
): Promise<PortfolioActionState> {
  // See createAssetAction: the redirect must escape the try/catch below.
  const user = await requireUser(DASHBOARD_PATH);

  const assetId = validateAssetId(formData);
  if (!assetId) {
    return failureState('ไม่พบหลักทรัพย์ที่ต้องการลบ');
  }

  let symbol = '';

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('assets')
      .delete()
      .eq('id', assetId)
      .select('id, symbol');

    if (error) {
      return failureState(toWriteErrorMessage(error));
    }

    if (!data || data.length === 0) {
      return failureState('ไม่พบหลักทรัพย์ที่ต้องการลบ');
    }

    symbol = data[0]?.symbol ?? '';
  } catch {
    return failureState(GENERIC_WRITE_ERROR_MESSAGE);
  }

  revalidatePath(DASHBOARD_PATH);
  return successState(
    `ลบหลักทรัพย์ ${symbol} พร้อมรายการซื้อ/ขายที่เกี่ยวข้องแล้ว`.trim(),
  );
}

