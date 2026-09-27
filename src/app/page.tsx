import Link from 'next/link';

import { getCurrentUser } from '@/lib/supabase/server';

/**
 * Public landing page. Server Component: it reads the session on the server so
 * the header already knows whether to show "Sign in" or the user's email.
 */
export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">
        AI US Stock &amp; ETF Portfolio Analytics
      </h1>

      <p className="mt-3 text-slate-400">
        ติดตามพอร์ตโฟลิโอหุ้นและกองทุนของคุณ พร้อมบทวิเคราะห์เชิงลึกจาก AI
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {user ? (
          <>
            <p className="rounded-lg border border-surface-border bg-surface-raised px-4 py-2.5 text-sm text-slate-300">
              เข้าสู่ระบบแล้วในชื่อ {user.email ?? user.id}
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              ไปที่แดชบอร์ด
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              เข้าสู่ระบบ
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg border border-surface-border bg-surface-raised px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-brand-500"
            >
              สมัครสมาชิก
            </Link>
          </>
        )}
      </div>

      <p className="mt-12 text-xs text-slate-500">
        ผลวิเคราะห์ประมวลผลโดย AI ไม่ใช่คำแนะนำทางการเงิน (Not Financial
        Advice)
      </p>
    </main>
  );
}
