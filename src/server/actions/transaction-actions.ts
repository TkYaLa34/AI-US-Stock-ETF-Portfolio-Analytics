'use server';

/**
 * Transaction server actions: BUY / SELL trades.
 *
 * Calls a plpgsql function from 20260925000000_init_schema_and_functions.sql,
 * because every trade movement has to touch a ledger row AND the derived position at the
 * same time:
 *
 *   BUY  -> transactions + assets.quantity + assets.average_cost + cash_balance
 *   SELL -> transactions + assets.quantity                  + cash_balance
 *
 * Inside Postgres they are one transaction, and they are `security invoker`, so RLS
 * still decides which rows the caller is allowed to touch.
 *
 * The ledger is append only from the UI in Phase 3: there is no edit or delete
 * action here on purpose. A mistake is corrected with an offsetting trade.
 */

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/require-user';
import { DASHBOARD_PATH } from '@/lib/portfolio/constants';
import {
  logSupabaseError,
  logThrownError,
  toErrorDetail,
  toThrownErrorDetail,
} from '@/lib/portfolio/diagnostics';
import { GENERIC_WRITE_ERROR_MESSAGE, toWriteErrorMessage } from '@/lib/portfolio/errors';
import {
  failureState,
  invalidState,
  successState,
  TRADE_TYPE_LABELS,
  type PortfolioActionState,
} from '@/lib/portfolio/types';
import { validateTrade } from '@/lib/portfolio/validation';
import { createClient } from '@/lib/supabase/server';

export async function createTradeAction(
  _previousState: PortfolioActionState,
  formData: FormData,
): Promise<PortfolioActionState> {
  // OUTSIDE the try/catch: redirect() throws, and must not be swallowed.
  const user = await requireUser(DASHBOARD_PATH);

  const { fieldErrors, values } = validateTrade(formData);
  if (!values) {
    return invalidState(fieldErrors);
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase.rpc('record_trade', {
      p_portfolio_id: values.portfolioId,
      p_asset_id: values.assetId,
      p_transaction_type: values.transactionType,
      p_quantity: values.quantity,
      p_price: values.price,
      p_fees: values.fees,
      p_trade_date: values.tradeDate,
      p_notes: values.notes,
    });

    if (error) {
      logSupabaseError('createTradeAction: rpc record_trade', error, {
        portfolioId: values.portfolioId,
        assetId: values.assetId,
        transactionType: values.transactionType,
      });

      /*
       * PT001 (not enough cash) and PT003 (selling more than held) are the two
       * failures a user can actually fix by changing the numbers, so they are
       * attached to the field rather than shown as a page level banner. The
       * detail rides along in both branches, so the server console keeps the
       * real SQLSTATE either way.
       */
      if (error.code === 'PT003') {
        return invalidState(
          { quantity: toWriteErrorMessage(error) },
          'กรุณาตรวจสอบข้อมูลที่กรอก',
          toErrorDetail(error),
        );
      }
      if (error.code === 'PT001') {
        return invalidState(
          { price: toWriteErrorMessage(error) },
          'กรุณาตรวจสอบข้อมูลที่กรอก',
          toErrorDetail(error),
        );
      }
      return failureState(toWriteErrorMessage(error), toErrorDetail(error));
    }
  } catch (caught) {
    logThrownError('createTradeAction: rpc record_trade', caught, {
      portfolioId: values.portfolioId,
      assetId: values.assetId,
    });
    return failureState(
      GENERIC_WRITE_ERROR_MESSAGE,
      toThrownErrorDetail(caught),
    );
  }

  // Computed after the write succeeds, purely for the confirmation message.
  const total = values.quantity * values.price;

  revalidatePath(DASHBOARD_PATH);
  const label = TRADE_TYPE_LABELS[values.transactionType] ?? values.transactionType;
  return successState(
    `บันทึกรายการ${label}เรียบร้อยแล้ว (มูลค่ารายการ ${total.toFixed(2)})`,
  );
}
