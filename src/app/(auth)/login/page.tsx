import type { Metadata } from 'next';

import { LoginForm } from '@/components/features/auth/login-form';
import { safeRedirectPath } from '@/lib/auth/redirect';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ | AI Portfolio Analytics',
};

interface LoginPageProps {
  // Next.js 15 hands searchParams to Server Components as a Promise.
  searchParams: Promise<{
    next?: string;
    /** Set by the callback route when a confirmation link fails. */
    error?: string;
  }>;
}

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  invalid_code: 'ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่อีกครั้ง',
  exchange_failed: 'ยืนยันบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, error } = await searchParams;

  // Sanitised here as well as in the action: this value is also rendered into
  // a hidden input, and the page is cacheable.
  const nextPath = safeRedirectPath(next);

  const notice =
    !error && next
      ? 'กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ'
      : null;

  return (
    <>
      <h2 className="mb-6 text-lg font-semibold text-slate-100">
        เข้าสู่ระบบ
      </h2>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-200"
        >
          {CALLBACK_ERROR_MESSAGES[error] ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'}
        </p>
      ) : null}

      <LoginForm nextPath={nextPath} notice={notice ?? undefined} />
    </>
  );
}
