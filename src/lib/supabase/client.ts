'use client';

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '../../types/database.types';
import { getPublicSupabaseEnv } from '../env';

/**
 * Derived from the factory rather than written as `SupabaseClient<Database>`:
 * createBrowserClient returns a client whose SchemaName/Schema type arguments
 * are inferred from Database, and spelling the alias out by hand would use the
 * library's defaults instead, which are not assignable in either direction.
 */
export type SupabaseBrowserClient = ReturnType<
  typeof createBrowserClient<Database>
>;

let browserClient: SupabaseBrowserClient | undefined;

/**
 * Browser / Client Component client.
 *
 * A single instance is cached on the module so that React state, realtime
 * channels and in-flight requests survive re-renders.
 */
export function createClient(): SupabaseBrowserClient {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getPublicSupabaseEnv();
  browserClient = createBrowserClient<Database>(url, anonKey);

  return browserClient;
}
