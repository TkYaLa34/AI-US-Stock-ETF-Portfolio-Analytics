'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { signUpAction } from '@/server/actions/auth-actions';
import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { INITIAL_AUTH_STATE } from '@/lib/auth/types';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/validation';

export interface SignUpFormProps {
  nextPath: string;
}

export function SignUpForm({ nextPath }: SignUpFormProps) {
  const [state, formAction] = useActionState(signUpAction, INITIAL_AUTH_STATE);

  // A success state means "check your inbox", so the form must not re-render.
  if (state.status === 'success') {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" message={state.message ?? 'สมัครสมาชิกสำเร็จ'} />
        <Link
          href="/login"
          className="text-center text-sm font-medium text-brand-400 hover:text-brand-300"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="next" value={nextPath} />

      {state.message ? <Alert tone="error" message={state.message} /> : null}

      <FormField
        label="ชื่อ-นามสกุล (ไม่บังคับ)"
        name="fullName"
        type="text"
        autoComplete="name"
        placeholder="Jane Doe"
        error={state.fieldErrors.fullName}
      />

      <FormField
        label="อีเมล"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        error={state.fieldErrors.email}
      />

      <FormField
        label="รหัสผ่าน"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`อย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`}
        error={state.fieldErrors.password}
      />

      <FormField
        label="ยืนยันรหัสผ่าน"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors.confirmPassword}
      />

      <FormField
        label="ชื่อพอร์ตโฟลิโอแรก (ไม่บังคับ)"
        name="portfolioName"
        type="text"
        placeholder="Growth Portfolio"
        hint={
          'ถ้าเว้นว่างไว้ ระบบจะตั้งชื่อพอร์ตโฟลิโอแรกให้เป็น "My Portfolio" ให้อัตโนมัติ'
        }
        error={state.fieldErrors.portfolioName}
      />

      <SubmitButton pendingLabel="กำลังสมัครสมาชิก...">
        สมัครสมาชิก
      </SubmitButton>

      <p className="text-center text-sm text-slate-400">
        มีบัญชีอยู่แล้ว?{' '}
        <Link
          href={`/login?next=${encodeURIComponent(nextPath)}`}
          className="font-medium text-brand-400 hover:text-brand-300"
        >
          เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}
