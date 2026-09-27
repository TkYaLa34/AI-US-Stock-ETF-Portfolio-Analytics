/**
 * Server side validation for the auth forms.
 *
 * Every rule is checked on the server even though the inputs are also
 * constrained in the browser. Client validation is a UX affordance only - a
 * request can arrive from anywhere, so the server is the real gate.
 */

import type { AuthFieldErrors } from './types';

/** Mirrors the HTML5 `type="email"` check closely enough for a real address. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_MIN_LENGTH = 8;

/** Matches `portfolios_name_not_blank` in the core schema migration. */
export const PORTFOLIO_NAME_MAX_LENGTH = 120;

function readField(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

export interface SignUpInput {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  portfolioName: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export function validateSignUp(formData: FormData): {
  fieldErrors: AuthFieldErrors;
  values: SignUpInput;
} {
  const email = readField(formData, 'email');
  const password = readField(formData, 'password');
  const confirmPassword = readField(formData, 'confirmPassword');
  const fullName = readField(formData, 'fullName');
  const portfolioName = readField(formData, 'portfolioName');

  const fieldErrors: AuthFieldErrors = {};

  if (email === '') {
    fieldErrors.email = 'กรุณากรอกอีเมล';
  } else if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
  }

  if (password === '') {
    fieldErrors.password = 'กรุณากรอกรหัสผ่าน';
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    fieldErrors.password = `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`;
  }

  if (confirmPassword === '') {
    fieldErrors.confirmPassword = 'กรุณายืนยันรหัสผ่าน';
  } else if (password !== confirmPassword) {
    fieldErrors.confirmPassword = 'รหัสผ่านทั้งสองไม่ตรงกัน';
  }

  if (portfolioName.length > PORTFOLIO_NAME_MAX_LENGTH) {
    fieldErrors.portfolioName = `ชื่อพอร์ตโฟลิโอต้องไม่เกิน ${PORTFOLIO_NAME_MAX_LENGTH} ตัวอักษร`;
  }

  return {
    fieldErrors,
    values: { email, password, confirmPassword, fullName, portfolioName },
  };
}

export function validateSignIn(formData: FormData): {
  fieldErrors: AuthFieldErrors;
  values: SignInInput;
} {
  const email = readField(formData, 'email');
  const password = readField(formData, 'password');

  const fieldErrors: AuthFieldErrors = {};

  if (email === '') {
    fieldErrors.email = 'กรุณากรอกอีเมล';
  } else if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
  }

  if (password === '') {
    fieldErrors.password = 'กรุณากรอกรหัสผ่าน';
  }

  return { fieldErrors, values: { email, password } };
}

/**
 * Turns a Supabase auth error into a message that is safe to render.
 *
 * Supabase returns a generic "Invalid login credentials" for both a wrong
 * email and a wrong password on purpose (no user enumeration). We keep that
 * behaviour rather than leaking which half was wrong.
 */
export function toAuthErrorMessage(errorMessage: string): string {
  const normalised = errorMessage.toLowerCase();

  if (normalised.includes('invalid login credentials')) {
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  }
  if (normalised.includes('email not confirmed')) {
    return 'อีเมลนี้ยังไม่ได้ยืนยัน กรุณากดลิงก์ยืนยันในอีเมล';
  }
  if (normalised.includes('user already registered')) {
    return 'อีเมลนี้ถูกใช้สมัครสมาชิกไว้แล้ว กรุณาเข้าสู่ระบบแทน';
  }
  if (normalised.includes('rate limit') || normalised.includes('too many')) {
    return 'พยายามหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
  }
  if (normalised.includes('password should be')) {
    return `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`;
  }

  return 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง';
}
