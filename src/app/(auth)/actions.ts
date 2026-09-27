'use server';

/**
 * Sign-in / sign-up server actions.
 *
 * Why Server Actions instead of a client component calling supabase.auth
 * directly:
 *   * the session cookies are written server side, so the redirect that follows
 *     already carries a valid session,
 *   * no auth logic is shipped to the browser,
 *   * `createClient()` binds to the request cookies, which is exactly what the
 *     SSR helpers in src/lib/supabase are for.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { safeRedirectPath } from '@/lib/auth/redirect';
import type { AuthActionState } from '@/lib/auth/types';
import {
  toAuthErrorMessage,
  validateSignIn,
  validateSignUp,
} from '@/lib/auth/validation';
import { createClient } from '@/lib/supabase/server';

/**
 * Builds the absolute URL Supabase should send the confirmation email to.
 *
 * `Origin` is set by the browser on same-origin POSTs but is absent in some
 * server-to-server contexts, hence the fallbacks. The value is only ever used
 * to construct a link the user clicks, and it is re-validated by the callback
 * route, so this is not a spoofable trust boundary.
 */
async function getRequestOrigin(): Promise<string | null> {
  const headerList = await headers();
  const origin = headerList.get('origin');
  if (origin) {
    return origin;
  }

  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  if (!host) {
    return null;
  }

  const protocol = headerList.get('x-forwarded-proto') ?? 'http';
  return `${protocol}://${host}`;
}

function readNext(formData: FormData): string {
  const value = formData.get('next');
  return safeRedirectPath(typeof value === 'string' ? value : null);
}

function validationErrorState(
  fieldErrors: AuthActionState['fieldErrors'],
): AuthActionState {
  return {
    status: 'error',
    message: 'กรุณาตรวจสอบข้อมูลที่กรอก',
    fieldErrors,
  };
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { fieldErrors, values } = validateSignIn(formData);

  if (Object.keys(fieldErrors).length > 0) {
    return validationErrorState(fieldErrors);
  }

  const nextPath = readNext(formData);

  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      return {
        status: 'error',
        message: toAuthErrorMessage(error.message),
        fieldErrors: {},
      };
    }
  } catch {
    return {
      status: 'error',
      message: 'เชื่อมต่อระบบยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      fieldErrors: {},
    };
  }

  // IMPORTANT: redirect() works by THROWING a sentinel error. It must stay
  // outside the try/catch above or the catch would swallow it and the user
  // would sit on a dead form.
  redirect(nextPath);
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { fieldErrors, values } = validateSignUp(formData);

  if (Object.keys(fieldErrors).length > 0) {
    return validationErrorState(fieldErrors);
  }

  const nextPath = readNext(formData);
  const origin = await getRequestOrigin();
  const callbackUrl = origin
    ? `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
    : undefined;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: callbackUrl,
        /*
         * user_metadata is read by the `handle_new_user()` trigger in
         * 20260925000100_create_core_schema.sql, which uses portfolio_name to
         * name the default portfolio it creates. Leave it undefined and the
         * trigger falls back to "My Portfolio".
         */
        data: {
          full_name: values.fullName || undefined,
          portfolio_name: values.portfolioName || undefined,
        },
      },
    });

    if (error) {
      return {
        status: 'error',
        message: toAuthErrorMessage(error.message),
        fieldErrors: {},
      };
    }

    /*
     * `data.session` is null when the project requires email confirmation.
     * The account exists either way, so this is a success, just a different
     * kind of success: tell the user to go check their inbox.
     */
    if (data.session === null) {
      return {
        status: 'success',
        message:
          'สมัครสมาชิกสำเร็จ กรุณาไปที่อีเมลของคุณเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ',
        fieldErrors: {},
      };
    }
  } catch {
    return {
      status: 'error',
      message: 'เชื่อมต่อระบบยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      fieldErrors: {},
    };
  }

  // Confirmations are disabled, so we already hold a session.
  redirect(nextPath);
}
