/**
 * Centralised, validated access to environment variables.
 *
 * .clinerules section 2 forbids hardcoding credentials, so every Supabase
 * setting is read here and nowhere else in the codebase.
 *
 * IMPORTANT: the `NEXT_PUBLIC_*` reads below MUST stay written out as literal
 * property accesses. Next.js inlines those at build time by static analysis, so
 * a dynamic lookup such as `process.env[name]` silently becomes `undefined`
 * in the browser bundle.
 */

export interface PublicSupabaseEnv {
  readonly url: string;
  readonly anonKey: string;
}

export interface ServerSupabaseEnv extends PublicSupabaseEnv {
  /** Optional: only needed by trusted server-side jobs (e.g. AI cache sweeps). */
  readonly serviceRoleKey: string | undefined;
}

export class MissingEnvError extends Error {
  constructor(variableName: string) {
    super(
      `Missing environment variable "${variableName}". ` +
        'Add it to your .env.local file and restart the dev server.',
    );
    this.name = 'MissingEnvError';
  }
}

function requireLiteral(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === '') {
    throw new MissingEnvError(name);
  }
  return value;
}

/**
 * Safe to call from both Server and Client Components.
 * Uses only the publishable anon key, which is designed to be public.
 */
export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  return {
    url: requireLiteral(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      'NEXT_PUBLIC_SUPABASE_URL',
    ),
    anonKey: requireLiteral(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ),
  };
}

/**
 * Server Components, Route Handlers and Server Actions only.
 * Never call this from a file marked `'use client'`.
 */
export function getServerSupabaseEnv(): ServerSupabaseEnv {
  return {
    ...getPublicSupabaseEnv(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
