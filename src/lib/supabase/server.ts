import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@/types/database.types';
import { getPublicSupabaseEnv } from '@/lib/env';

/** See the note on SupabaseBrowserClient: derived, not hand-written. */
export type SupabaseServerClient = ReturnType<
  typeof createServerClient<Database>
>;

/**
 * Server Component / Route Handler / Server Action client.
 *
 * The session is carried in cookies so that RLS in Postgres evaluates against
 * the signed-in user. `getServerSupabaseEnv` is intentionally not used here:
 * the service role key bypasses RLS and must never back a user-facing request.
 */
export async function createClient(): Promise<SupabaseServerClient> {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Safe to ignore: the
          // middleware has already refreshed the session for this request.
        }
      },
    },
  });
}

/**
 * Reads the current user on the server.
 * Returns null when the visitor is not signed in - never throws.
 */
export async function getCurrentUser(): Promise<
  { id: string; email: string | null } | null
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    return { id: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}
