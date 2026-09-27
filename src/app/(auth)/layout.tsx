import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { DEFAULT_AUTHENTICATED_PATH } from '@/lib/auth/types';
import { getCurrentUser } from '@/lib/supabase/server';

/**
 * Chrome shared by /login and /signup.
 *
 * The redirect is deliberate defence in depth: src/middleware.ts already
 * bounces signed-in users away from these pages, but the layout keeps the rule
 * true even if the matcher is ever narrowed.
 */
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect(DEFAULT_AUTHENTICATED_PATH);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-100">
            AI US Stock &amp; ETF Portfolio Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            จัดการพอร์ตโฟลิโอหุ้นและกองทุนของคุณ
          </p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-xl">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          ผลวิเคราะห์ประมวลผลโดย AI ไม่ใช่คำแนะนำทางการเงิน (Not Financial
          Advice)
        </p>
      </div>
    </main>
  );
}
