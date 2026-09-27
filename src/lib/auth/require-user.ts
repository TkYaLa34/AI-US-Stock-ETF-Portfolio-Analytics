/**
 * Auth guard for the Phase 3 server actions.
 *
 * `getCurrentUser()` returns null instead of throwing, so a caller that forgot
 * to check would happily write with a null owner. Every action funnels through
 * here instead.
 *
 * IMPORTANT: `redirect()` works by throwing a sentinel error, so callers must
 * invoke this OUTSIDE their try/catch. See signInAction in
 * src/app/(auth)/actions.ts for the same pattern.
 */

import { redirect } from 'next/navigation';

import { DEFAULT_AUTHENTICATED_PATH } from './types';
import { getCurrentUser } from '../supabase/server';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

export async function requireUser(nextPath: string): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(safeActionPath(nextPath))}`,
    );
  }

  return user;
}

/**
 * `nextPath` is a server-controlled constant in every call site, never caller
 * input, but the single-slash check is applied anyway so this helper stays safe
 * if that ever changes.
 */
function safeActionPath(nextPath: string): string {
  if (!nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  return nextPath;
}
