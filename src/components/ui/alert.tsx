import { AlertCircle, CheckCircle2 } from 'lucide-react';

export type AlertTone = 'error' | 'success';

export interface AlertProps {
  tone: AlertTone;
  message: string;
}

const TONE_STYLES: Record<AlertTone, string> = {
  error: 'border-red-500/40 bg-red-500/10 text-red-200',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
};

/**
 * Inline status message for form results.
 *
 * Decorative icons are aria-hidden and the message itself is announced, so a
 * screen reader hears the outcome once it appears.
 */
export function Alert({ tone, message }: AlertProps) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${TONE_STYLES[tone]}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
