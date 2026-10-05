/**
 * Maps Supabase / Postgres errors onto messages that are safe to render.
 *
 * The SQL in initial schema migration raises with machine readable SQLSTATEs,
 * so the app matches on `code` rather than on the English text.
 */

import type { PostgrestError } from '@supabase/supabase-js';

/** SQLSTATEs raised on purpose by public.record_trade. */
const FUNCTION_ERROR_MESSAGES: Record<string, string> = {
  PT000: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',
  PT001: 'เงินสดในพอร์ตโฟลิโอไม่เพียงพอสำหรับรายการนี้',
  PT002: 'ไม่พบข้อมูลที่ระบุ หรือคุณไม่มีสิทธิ์เข้าถึง',
  PT003: 'จำนวนที่ขายมากกว่าจำนวนที่ถืออยู่ในพอร์ตโฟลิโอ',
  PT004: 'ข้อมูลรายการไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
};

/** Standard Postgres / PostgREST codes worth a specific message. */
const POSTGRES_ERROR_MESSAGES: Record<string, string> = {
  // unique_violation
  '23505': 'มีข้อมูลนี้อยู่แล้วในพอร์ตโฟลิโอ',
  // foreign_key_violation
  '23503': 'ข้อมูลที่เลือกไม่ถูกต้องหรือถูกลบไปแล้ว',
  // check_violation
  '23514': 'ข้อมูลไม่ผ่านเงื่อนไขของระบบ กรุณาตรวจสอบอีกครั้ง',
  // not_null_violation
  '23502': 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ',
  // invalid_text_representation, e.g. a bad uuid or number
  '22P02': 'รูปแบบข้อมูลไม่ถูกต้อง',
  // insufficient_privilege, raised by guard_transaction_immutability
  '42501': 'ไม่สามารถแก้ไขรายการนี้ได้',
  /*
   * SCHEMA DRIFT - the three that matter when a migration has not been run yet,
   * which is by far the most common cause of a generic failure in development.
   * The code alone does not say which table, so the friendly message points at
   * the fix and the raw text stays in the detail / the server log.
   */
  // undefined_table
  '42P01': 'ยังไม่มีตารางนี้ในฐานข้อมูล กรุณาตรวจสอบว่า migration ถูกรันครบแล้ว',
  // undefined_column
  '42703': 'คอลัมน์ที่ระบบเรียกใช้ยังไม่มีอยู่ กรุณาตรวจสอบว่า migration ถูกรันครบแล้ว',
  // undefined_function, raised when an rpc() call has no matching signature
  PGRST202:
    'ยังไม่มีฟังก์ชันที่ระบบเรียกใช้ในฐานข้อมูล กรุณาตรวจสอบว่า migration ถูกรันครบแล้ว',
  // PGRST205, the same thing under a different PostgREST version
  PGRST205:
    'ยังไม่มีฟังก์ชันที่ระบบเรียกใช้ในฐานข้อมูล กรุณาตรวจสอบว่า migration ถูกรันครบแล้ว',
  // PGRST116, .single() / .maybeSingle() on zero rows
  PGRST116: 'ไม่พบข้อมูลที่ระบุ หรือคุณไม่มีสิทธิ์เข้าถึง',
  // query_canceled, e.g. statement_timeout
  '57014': 'การทำรายการใช้เวลานานเกินกำหนด กรุณาลองใหม่อีกครั้ง',
};

export const GENERIC_WRITE_ERROR_MESSAGE =
  'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';

/** True when the failure was the unique index, so the field can be flagged. */
export function isUniqueViolation(error: PostgrestError | null): boolean {
  return error?.code === '23505';
}

/**
 * `details` on a unique_violation from PostgREST looks like
 * "Key (portfolio_id, symbol)=(..., AAPL) already exists."
 * Extract the column names so the form can point at the right input.
 */
export function uniqueViolationColumns(error: PostgrestError | null): string[] {
  if (!error || !isUniqueViolation(error) || !error.details) {
    return [];
  }

  const match = /Key \(([^)]+)\)=/.exec(error.details);
  if (!match?.[1]) {
    return [];
  }

  return match[1].split(',').map((column) => column.trim());
}

/**
 * A message that is safe and useful to show. Never returns a raw Postgres
 * string, because those leak table and column names.
 */
export function toWriteErrorMessage(error: PostgrestError | null): string {
  if (!error) {
    return GENERIC_WRITE_ERROR_MESSAGE;
  }

  return (
    FUNCTION_ERROR_MESSAGES[error.code] ??
    POSTGRES_ERROR_MESSAGES[error.code] ??
    GENERIC_WRITE_ERROR_MESSAGE
  );
}

/** A message for a read path failure, which is logged rather than shown raw. */
export function toReadErrorMessage(error: PostgrestError | null): string {
  return toWriteErrorMessage(error);
}
