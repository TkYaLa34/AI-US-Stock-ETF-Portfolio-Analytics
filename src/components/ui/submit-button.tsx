'use client';

import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

export interface SubmitButtonProps {
  children: React.ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  /**
   * Defaults to true, which is right for the auth forms. Set false when the
   * button sits in a row next to a Cancel button rather than spanning a form.
   */
  fullWidth?: boolean;
  tone?: 'brand' | 'danger';
}

/**
 * Submit button that reflects the form's pending state.
 *
 * `useFormStatus` only works for a button rendered *inside* the <form> that
 * carries the action, which is why this is a separate component rather than a
 * prop on the form.
 */
export function SubmitButton({
  children,
  pendingLabel,
  disabled = false,
  fullWidth = true,
  tone = 'brand',
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  const TONE_STYLES = {
    brand:
      'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-400',
    danger:
      'bg-red-600 text-white hover:bg-red-700 focus:ring-red-400',
  } as const;

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 ${
        fullWidth ? 'w-full' : ''
      } ${TONE_STYLES[tone]}`}
    >
      {pending ? (
        <>
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        <span>{children}</span>
      )}
    </button>
  );
}
