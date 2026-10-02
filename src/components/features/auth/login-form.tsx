'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { signInAction } from '@/server/actions/auth-actions';
import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { INITIAL_AUTH_STATE } from '@/lib/auth/types';

export interface LoginFormProps {
  /** Where to land after a successful sign-in. Already sanitised server side. */
  nextPath: string;
  /** Pre-filled when the user just came from a confirmation email. */
  notice?: string;
}

export function LoginForm({ nextPath, notice }: LoginFormProps) {
  const [state, formAction] = useActionState(signInAction, INITIAL_AUTH_STATE);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {/* Lets the action send the user back where the middleware intercepted them. */}
      <input type="hidden" name="next" value={nextPath} />

      {notice ? <Alert tone="success" message={notice} /> : null}
      {state.message ? (
        <Alert tone={state.status === 'success' ? 'success' : 'error'} message={state.message} />
      ) : null}

      <FormField
        label="อีเมล"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        error={state.fieldErrors.email}
        disabled={state.status === 'success'}
      />

      <FormField
        label="รหัสผ่าน"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors.password}
        disabled={state.status === 'success'}
      />

      <SubmitButton pendingLabel="กำลังเข้าสู่ระบบ...">
        เข้าสู่ระบบ
      </SubmitButton>

      <p className="text-center text-sm text-slate-400">
        ยังไม่มีบัญชี?{' '}
        <Link
          href={`/signup?next=${encodeURIComponent(nextPath)}`}
          className="font-medium text-brand-400 hover:text-brand-300"
        >
          สมัครสมาชิก
        </Link>
      </p>
    </form>
  );
}
