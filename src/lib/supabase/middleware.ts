import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

import type { Database } from '../../types/database.types';
import { getPublicSupabaseEnv } from '../env';

/** See the note on SupabaseBrowserClient: derived, not hand-written. */
export type SupabaseMiddlewareClient = ReturnType<
  typeof createServerClient<Database>
>;

export interface SessionContext {
  /** Request scoped client, used to read the session and rotate tokens. */
  supabase: SupabaseMiddlewareClient;
  /**
   * The response to hand back to Next. It is a *mutable reference*: whenever
   * Supabase refreshes a token inside this function, the cookies are written
   * onto a fresh NextResponse and this value is replaced. Callers must send
   * the object returned here, never the response they created themselves.
   */
  response: NextResponse;
  /** The signed-in user, or null for an anonymous visitor. */
  user: User | null;
}

/**
 * Refreshes the Supabase auth session on every matched request and returns the
 * (possibly replaced) response.
 *
 * Two things happen here that are easy to get wrong:
 *
 *  1. Cookie writes must be copied onto the outgoing response. The middleware
 *     runs before the route renders, so a rotated refresh token only reaches
 *     the browser if we attach it to the response we return.
 *
 *  2. `getUser()` is used, NOT `getSession()`. getSession only decodes the JWT
 *     that is already in the cookie without checking its signature, so a
 *     revoked or forged token would pass. getUser revalidates against the
 *     Supabase Auth server, which is what makes the session trustworthy.
 */
export async function updateSession(
  request: NextRequest,
): Promise<SessionContext> {
  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = getPublicSupabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Mirror the incoming cookies so the outgoing request stays consistent.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        supabaseResponse = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // SAFETY: no early return before this call. getUser() is what triggers the
  // token refresh above; skip it and the session silently expires.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, response: supabaseResponse, user };
}
