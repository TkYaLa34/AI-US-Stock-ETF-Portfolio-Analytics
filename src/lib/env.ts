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
  constructor(variableName: string, reason?: string) {
    super(
      reason ??
        `Missing environment variable "${variableName}". ` +
          'Add it to your .env.local file and restart the dev server.',
    );
    this.name = 'MissingEnvError';
  }
}

/**
 * The literal values .env.example ships with.
 *
 * Copying the template and forgetting to fill it in is the single most common
 * setup mistake, and it is invisible: a non-empty string passes every `!value`
 * check, so the app boots happily, builds a Supabase client pointed at a host
 * that does not exist, and the user meets it as an opaque `ENOTFOUND
 * your-project-ref.supabase.co` from deep inside supabase-js with no hint that
 * the file was never edited. Rejecting the placeholders turns that into an
 * immediate, self-explanatory error naming the variable to fix.
 */
const PLACEHOLDER_VALUES: Readonly<Record<string, readonly string[]>> = {
  NEXT_PUBLIC_SUPABASE_URL: [
    'your-project-ref.supabase.co',
    'your-project-ref',
    'https://your-project-ref.supabase.co',
  ],
  NEXT_PUBLIC_SUPABASE_ANON_KEY: [
    'your-anon-key-here',
    'your-anon-key',
  ],
  SUPABASE_SERVICE_ROLE_KEY: [
    'your-service-role-key-here',
    'your-service-role-key',
  ],
};

function requireLiteral(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === '') {
    throw new MissingEnvError(name);
  }

  const placeholders = PLACEHOLDER_VALUES[name];
  if (
    placeholders?.some(
      (placeholder) => placeholder === value.trim().toLowerCase(),
    )
  ) {
    throw new MissingEnvError(
      name,
      `Environment variable "${name}" still holds the placeholder value from ` +
        '.env.example. Replace it with the real value from Supabase Dashboard ' +
        '-> Project Settings -> API, then restart the dev server.',
    );
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
