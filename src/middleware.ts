import { NextResponse, type NextRequest } from 'next/server';

import { safeRedirectPath } from '@/lib/auth/redirect';
import { MissingEnvError } from '@/lib/env';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Route protection.
 *
 * The middleware runs on every non-static request and does two jobs:
 *   1. refresh the Supabase session (see src/lib/supabase/middleware.ts)
 *   2. gate the private routes and bounce signed-in users away from /login
 */

/** Only ever redirect to these. */
const AUTH_ROUTES = ['/login', '/signup'] as const;

/** Everything under these prefixes requires a session. */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/portfolios',
  '/transactions',
  '/settings',
] as const;

const LOGIN_PATH = '/login';

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Pulls `?next=` out of a raw query string without throwing. */
function nextFromSearch(search: string): string | null {
  return new URLSearchParams(search).get('next');
}

/** Copies refreshed auth cookies onto a response we are about to return. */
function carryCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

/**
 * NOTE: this is UX, not security. RLS in Postgres is the real boundary - a
 * signed-out visitor can still load these URLs, they will simply see empty
 * data, because every policy compares auth.uid() against the row owner.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  let user: Awaited<ReturnType<typeof updateSession>>['user'];
  let sessionResponse: NextResponse;

  try {
    const context = await updateSession(request);
    user = context.user;
    sessionResponse = context.response;
  } catch (error) {
    // A missing env var would otherwise 500 on literally every request with an
    // opaque stack trace. Say what is actually wrong instead.
    if (error instanceof MissingEnvError) {
      return new NextResponse(
        `Supabase is not configured: ${error.message}`,
        {
          status: 503,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        },
      );
    }
    throw error;
  }

  if (user === null && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = '';
    // Remember where they were headed so login can send them back.
    loginUrl.searchParams.set('next', `${pathname}${search}`);

    return carryCookies(sessionResponse, NextResponse.redirect(loginUrl));
  }

  if (user !== null && matchesPrefix(pathname, AUTH_ROUTES)) {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = safeRedirectPath(nextFromSearch(search));
    targetUrl.search = '';

    return carryCookies(sessionResponse, NextResponse.redirect(targetUrl));
  }

  return sessionResponse;
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *   _next/static, _next/image  - build output
     *   favicon.ico                - static asset
     *   *.svg|png|jpg|jpeg|gif|webp|ico - static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
