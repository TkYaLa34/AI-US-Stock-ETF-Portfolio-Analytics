import type { Metadata } from 'next';

import { SignUpForm } from '@/components/features/auth/sign-up-form';
import { safeRedirectPath } from '@/lib/auth/redirect';

export const metadata: Metadata = {
  title: 'สมัครสมาชิก | AI Portfolio Analytics',
};

interface SignUpPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { next } = await searchParams;
  const nextPath = safeRedirectPath(next);

  return (
    <>
      <h2 className="mb-1 text-lg font-semibold text-slate-100">
        สมัครสมาชิก
      </h2>
      <p className="mb-6 text-sm text-slate-400">
        เราจะสร้างพอร์ตโฟลิโอแรกให้คุณโดยอัตโนมัติ
      </p>

      <SignUpForm nextPath={nextPath} />
    </>
  );
}
