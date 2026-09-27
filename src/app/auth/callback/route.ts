import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { safeRedirectPath } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';

/**
 * Auth callback.
 *
 * Supabase sends the user here in two different shapes depending on which
 * email template the project uses:
 *
 *   1. PKCE  -> ?code=...        exchanged with exchangeCodeForSession()
 *   2. token -> ?token_hash=...&type=signup   verified with verifyOtp()
 *
 * Both are handled so the app works whichever template is configured.
 *
 * This is a Route Handler, not a Server Component, so `cookies().set()` is
 * allowed - which is required, because the session has to be written to the
 * browser here.
 */

/** Only these `type` values are accepted from the query string. */
const ALLOWED_OTP_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

function redirectToLogin(
  request: NextRequest,
  reason: string,
): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('error', reason);

  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);

  // Supabase reports template/config problems here rather than as a network
  // failure, so this is the only place they can be caught.
  if (searchParams.has('error')) {
    return redirectToLogin(request, 'invalid_code');
  }

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type');

  const nextPath = safeRedirectPath(searchParams.get('next'));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return redirectToLogin(request, 'exchange_failed');
    }

    return NextResponse.redirect(`${origin}${nextPath}`);
  }

  if (tokenHash && rawType && ALLOWED_OTP_TYPES.includes(rawType as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      type: rawType as EmailOtpType,
      token_hash: tokenHash,
    });

    if (error) {
      return redirectToLogin(request, 'exchange_failed');
    }

    return NextResponse.redirect(`${origin}${nextPath}`);
  }

  return redirectToLogin(request, 'invalid_code');
}
