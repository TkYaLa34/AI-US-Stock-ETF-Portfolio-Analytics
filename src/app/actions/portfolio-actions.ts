'use server';

/**
 * Portfolio CRUD server actions.
 *
 * Why Server Actions rather than a Client Component calling supabase-js
 * directly: `createClient()` binds to the request cookies, so the RLS
 * policies evaluate against the signed-in user, and the session never has to
 * leave the server.
 *
 * Every action follows the same contract as the auth actions in
 * src/app/(auth)/actions.ts:
 *   * signature (previousState, formData) so it works with useActionState,
 *   * returns a plain serialisable PortfolioActionState - never throws,
 *   * revalidates the dashboard on success so the RSC re-renders with new data.
 *
 * SECURITY: the owner id is taken from the session via requireUser(), never
 * from form data. RLS is still the real boundary - these actions only exist to
 * give the user a readable error message.
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
import { validatePortfolio, validatePortfolioId } from '@/lib/portfolio/validation';
import { createClient } from '@/lib/supabase/server';

/**
 * portfolios_user_name_uidx is a unique index on (user_id, lower(name)), so a
 * duplicate surfaces as a 23505 naming the `name` column. Point the message at
 * the input instead of showing the raw Postgres detail.
 */
function portfolioNameTakenState(error: PostgrestError): PortfolioActionState {
  if (
    isUniqueViolation(error) &&
    uniqueViolationColumns(error).includes('name')
  ) {
    return invalidState({ name: 'คุณมีพอร์ตโฟลิโอชื่อนี้อยู่แล้ว' });
  }

  return failureState(toWriteErrorMessage(error));
}

export async function createPortfolioAction(
  _previousState: PortfolioActionState,
  formData: FormData,
): Promise<PortfolioActionState> {
  // OUTSIDE the try/catch: an expired session must redirect, and redirect()
  // signals by throwing - a catch here would turn it into a dead form.
  const user = await requireUser(DASHBOARD_PATH);

  const { fieldErrors, values } = validatePortfolio(formData);
  if (!values) {
    return invalidState(fieldErrors);
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase.from('portfolios').insert({
      // user_id comes from the session. RLS portfolios_insert_own re-checks it.
      user_id: user.id,
      name: values.name,
      description: values.description,
      base_currency: values.baseCurrency,
    });

    if (error) {
      return portfolioNameTakenState(error);
    }
  } catch {
    return failureState(GENERIC_WRITE_ERROR_MESSAGE);
  }

  revalidatePath(DASHBOARD_PATH);
  return successState(`สร้างพอร์ตโฟลิโอ "${values.name}" เรียบร้อยแล้ว`);
}

export async function updatePortfolioAction(
  _previousState: PortfolioActionState,
  formData: FormData,
): Promise<PortfolioActionState> {
  // See createPortfolioAction: the redirect must escape the try/catch below.
  const user = await requireUser(DASHBOARD_PATH);

  const portfolioId = validatePortfolioId(formData);
  if (!portfolioId) {
    return failureState('ไม่พบพอร์ตโฟลิโอที่ต้องการแก้ไข');
  }

  const { fieldErrors, values } = validatePortfolio(formData);
  if (!values) {
    return invalidState(fieldErrors);
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('portfolios')
      .update({
        name: values.name,
        description: values.description,
        base_currency: values.baseCurrency,
      })
      .eq('id', portfolioId)
      .select('id');

    if (error) {
      return portfolioNameTakenState(error);
    }

    // RLS filtered the update, so zero rows means "not yours or gone".
    if (!data || data.length === 0) {
      return failureState('ไม่พบพอร์ตโฟลิโอที่ต้องการแก้ไข');
    }
  } catch {
    return failureState(GENERIC_WRITE_ERROR_MESSAGE);
  }

  revalidatePath(DASHBOARD_PATH);
  return successState(`บันทึกการแก้ไขพอร์ตโฟลิโอ "${values.name}" เรียบร้อยแล้ว`);
}

/**
 * Cascades: assets and transactions in the portfolio go with it (see the
 * on delete cascade clauses in 20260925000100_create_core_schema.sql). The UI
 * confirms before calling this.
 */
export async function deletePortfolioAction(
  _previousState: PortfolioActionState,
  formData: FormData,
): Promise<PortfolioActionState> {
  // See createPortfolioAction: the redirect must escape the try/catch below.
  const user = await requireUser(DASHBOARD_PATH);

  const portfolioId = validatePortfolioId(formData);
  if (!portfolioId) {
    return failureState('ไม่พบพอร์ตโฟลิโอที่ต้องการลบ');
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', portfolioId)
      .select('id');

    if (error) {
      return failureState(toWriteErrorMessage(error));
    }

    if (!data || data.length === 0) {
      return failureState('ไม่พบพอร์ตโฟลิโอที่ต้องการลบ');
    }
  } catch {
    return failureState(GENERIC_WRITE_ERROR_MESSAGE);
  }

  // The page reads ?portfolio= from the URL, so a stale value must not pin the
  // dashboard to a portfolio that no longer exists. selectPortfolio() falls
  // back to the default when the id no longer resolves.
  revalidatePath(DASHBOARD_PATH);
  return successState('ลบพอร์ตโฟลิโอเรียบร้อยแล้ว');
}

/**
 * Moves the is_default flag through public.set_default_portfolio.
 *
 * portfolios_one_default_per_user_uidx is a PARTIAL unique index, so there can
 * only be one default per user. Clearing the old one and setting the new one
 * has to be a single atomic step, which is exactly what the function is for.
 */
export async function setDefaultPortfolioAction(
  _previousState: PortfolioActionState,
  formData: FormData,
): Promise<PortfolioActionState> {
  // See createPortfolioAction: the redirect must escape the try/catch below.
  const user = await requireUser(DASHBOARD_PATH);

  const portfolioId = validatePortfolioId(formData);
  if (!portfolioId) {
    return failureState('ไม่พบพอร์ตโฟลิโอที่ต้องการตั้งเป็นค่าเริ่มต้น');
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase.rpc('set_default_portfolio', {
      p_portfolio_id: portfolioId,
    });

    if (error) {
      return failureState(toWriteErrorMessage(error));
    }
  } catch {
    return failureState(GENERIC_WRITE_ERROR_MESSAGE);
  }

  revalidatePath(DASHBOARD_PATH);
  return successState('ตั้งเป็นพอร์ตโฟลิโอเริ่มต้นเรียบร้อยแล้ว');
}

