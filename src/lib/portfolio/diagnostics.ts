/**
 * Error diagnostics for the portfolio layer: log everything on the server, and
 * format the raw Supabase error so it can be shown in the UI while debugging.
 *
 * WHY THIS MODULE EXISTS
 *
 * supabase-js does not throw. A failed query comes back as
 * `{ data: null, error: PostgrestError }`, and only a thrown Error (a missing
 * env var, a dead socket) reaches a `catch`. Every one of those paths used to
 * collapse into "บันทึกข้อมูลไม่สำเร็จ" with nothing on the server console, so
 * the UI knew a write had failed but nobody - human or agent - could tell why.
 * Two functions below close that gap: log on EVERY failure (returned error and
 * thrown error alike), and carry the real message up to the user.
 *
 * WHY THE UI DETAIL IS GATED
 *
 * A raw PostgREST error leaks table and column names ("relation portfolios does
 * not exist", "Key (portfolio_id, symbol)=..."), which src/lib/portfolio/errors.ts
 * deliberately hides behind a friendly Thai sentence. Showing it unconditionally
 * would undo that. So the detail is attached only when it is useful and safe:
 *
 *   - `SHOW_ERROR_DETAILS=true`  -> always show (staging / when you are debugging)
 *   - `SHOW_ERROR_DETAILS=false` -> never show
 *   - unset                      -> show in dev only (NODE_ENV !== 'production')
 *
 * Either way the SERVER CONSOLE always gets the full error, so production
 * incidents are still debuggable from the logs without leaking schema to users.
 *
 * SERVER ONLY. The gate reads a non-public env var, which Next.js does not inline
 * for the browser, so a Client Component calling into this module would see
 * `undefined` and get it wrong. The detail string is therefore computed in the
 * Server Action / Server Component and handed to the client as a plain prop.
 */

import type { PostgrestError } from '@supabase/supabase-js';

/** Prefix on every log line, so a grep in the dev server finds all of them. */
const LOG_PREFIX = '[portfolio]';

/** Extra key/values merged into the logged object, e.g. the id being written. */
export type ErrorLogContext = Readonly<Record<string, unknown>>;

/**
 * PostgREST always sends the four fields, but a hand-built fallback error (see
 * toFallbackError in queries.ts) or a partial object from a failed fetch can
 * leave one of them undefined, so every field is defaulted rather than assumed.
 */
interface SupabaseErrorFields {
  readonly code: string;
  readonly message: string;
  readonly details: string;
  readonly hint: string;
}

function toFields(error: PostgrestError): SupabaseErrorFields {
  return {
    code: error.code ?? 'UNKNOWN',
    message: error.message ?? '(ไม่มีข้อความ)',
    details: error.details ?? '',
    hint: error.hint ?? '',
  };
}

/**
 * Logs a PostgrestError returned by supabase-js.
 *
 * Call this in the `if (error)` branch, NOT only in `catch`: that branch is where
 * essentially every real database failure lands, because PostgREST answers with
 * HTTP 4xx/5xx and a JSON body rather than a transport level throw.
 */
export function logSupabaseError(
  context: string,
  error: PostgrestError,
  extra: ErrorLogContext = {},
): void {
  console.error(`${LOG_PREFIX} ${context} -> ฐานข้อมูลตอบกลับข้อผิดพลาด`, {
    ...toFields(error),
    ...extra,
  });
}

/**
 * Logs something that was actually thrown - a MissingEnvError, a fetch failure,
 * or a non-Error value. Keeps the stack, which is the whole point of catching.
 */
export function logThrownError(
  context: string,
  error: unknown,
  extra: ErrorLogContext = {},
): void {
  if (error instanceof Error) {
    console.error(`${LOG_PREFIX} ${context} -> เกิดข้อยกเลยก (throw)`, {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      cause:
        error.cause instanceof Error
          ? error.cause.message
          : (error.cause ?? null),
      ...extra,
    });
    return;
  }

  console.error(`${LOG_PREFIX} ${context} -> throw ค่าที่ไม่ใช่ Error`, {
    thrown: error,
    ...extra,
  });
}

/** True when the raw database error may be rendered in the browser. */
export function isErrorDetailExposed(): boolean {
  const flag = process.env.SHOW_ERROR_DETAILS;

  if (flag === 'true') {
    return true;
  }

  if (flag === 'false') {
    return false;
  }

  return process.env.NODE_ENV !== 'production';
}

/** The raw error, formatted for display, or null when it must stay hidden. */
export function toErrorDetail(error: PostgrestError | null): string | null {
  if (!isErrorDetailExposed()) {
    return null;
  }

  return formatErrorDetail(error);
}

/** Same text without the gate, for logging and for the dev console. */
export function formatErrorDetail(error: PostgrestError | null): string | null {
  if (!error) {
    return null;
  }

  const { code, message, details, hint } = toFields(error);
  const lines = [`${code}: ${message}`];

  if (details) {
    lines.push(`details: ${details}`);
  }

  if (hint) {
    lines.push(`hint: ${hint}`);
  }

  return lines.join('\n');
}

/** The thrown counterpart of toErrorDetail, for the `catch` blocks. */
export function toThrownErrorDetail(error: unknown): string | null {
  if (!isErrorDetailExposed()) {
    return null;
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return typeof error === 'string' ? error : String(error);
}
