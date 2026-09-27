/**
 * Redirect helpers shared by the middleware and the auth server actions.
 *
 * Lives in its own module (rather than inside src/middleware.ts) because a
 * Server Action must never import from the middleware entry point.
 */

import { DEFAULT_AUTHENTICATED_PATH } from './types';

/**
 * Blocks open redirects.
 *
 * `?next=https://evil.example` must never bounce a user off-site, and
 * `//evil.example` is protocol relative: browsers read the leading `//` as
 * `https://evil.example` even though the string "starts with a slash". So the
 * check is a leading single slash, not merely "is non-empty".
 */
export function safeRedirectPath(
  next: string | null | undefined,
): string {
  if (!next) {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  if (!next.startsWith('/') || next.startsWith('//')) {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  return next;
}
