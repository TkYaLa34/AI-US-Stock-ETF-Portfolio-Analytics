'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy } from 'lucide-react';

export type AlertTone = 'error' | 'success';

export interface AlertProps {
  tone: AlertTone;
  message: string;
  /**
   * The underlying technical error - a Supabase SQLSTATE and its raw message -
   * shown behind a collapsed disclosure rather than inline.
   *
   * Production users should never need it, but while a migration is missing or
   * a query is broken, "บันทึกข้อมูลไม่สำเร็จ" on its own is useless and the real
   * answer ("42P01: relation \"portfolios\" does not exist") is what unblocks the
   * fix. The server decides whether to send it at all - see isErrorDetailExposed
   * in src/lib/portfolio/diagnostics.ts - so a null here means "nothing to show".
   */
  detail?: string | null;
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
export function Alert({ tone, message, detail = null }: AlertProps) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
  const [copied, setCopied] = useState(false);

  // Reverts the "คัดลอกแล้ว" label. Declared as an effect rather than a bare
  // setTimeout in the click handler so the timer is cleared if the alert
  // unmounts (the modal closes) between the click and the reset.
  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = setTimeout(() => setCopied(false), 2000);

    return () => clearTimeout(timer);
  }, [copied]);

  async function copyDetail(): Promise<void> {
    if (detail === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(detail);
      setCopied(true);
    } catch {
      // Clipboard can be denied (insecure origin, permissions). The text is
      // still selectable in the <pre>, so there is nothing worth interrupting
      // the user for.
      setCopied(false);
    }
  }

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-sm ${TONE_STYLES[tone]}`}
    >
      <div className="flex items-start gap-2">
        <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>

      {detail === null ? null : (
        <details className="ml-6 min-w-0">
          <summary className="w-fit cursor-pointer select-none text-xs font-medium text-current opacity-80 hover:opacity-100">
            ดูข้อความจริงจาก Supabase
          </summary>

          <div className="mt-1.5 flex min-w-0 flex-col gap-1.5">
            {/*
             * whitespace-pre-wrap + break-words: the raw message is one long line
             * with no spaces to wrap on, and a horizontal scrollbar inside a
             * mobile modal is worse than a wrapped block.
             */}
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/30 px-2 py-1.5 text-[11px] leading-relaxed">
              {detail}
            </pre>

            <button
              type="button"
              onClick={copyDetail}
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-current/30 px-2 py-1 text-xs font-medium opacity-80 transition-opacity hover:opacity-100"
            >
              <Copy aria-hidden="true" className="h-3 w-3" />
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}
            </button>
          </div>
        </details>
      )}
    </div>
  );
}
