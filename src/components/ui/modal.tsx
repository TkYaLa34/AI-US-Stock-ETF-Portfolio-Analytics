'use client';

/**
 * Accessible dialog used by every Phase 3 form.
 *
 * Built on <dialog>.showModal() rather than a hand-rolled overlay, because the
 * native element gives us, for free and correctly:
 *   * the top layer, so no z-index or overflow ancestor can trap it,
 *   * an inert background, so Tab cannot wander into the page behind,
 *   * Escape to close, without a keydown listener,
 *   * focus moved in on open and restored to the trigger on close.
 *
 * The two things it does NOT do natively, and which are handled below: closing
 * on a backdrop click, and locking body scroll.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  /** Rendered under a divider, after `children`. */
  footer?: ReactNode;
  /** Tailwind max-width class for the panel. */
  size?: 'md' | 'lg' | 'xl';
}

const SIZE_CLASSES = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
} as const;

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useIdFor(title);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    dialog.showModal();

    // A <dialog> that is open does not stop the page behind it from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape: tell React so the parent unmounts us, otherwise the native
        // dialog closes but the component stays mounted and unusable.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clicks land on the dialog element itself only when they hit the
        // backdrop, because the panel is a positioned child.
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
      className={`m-0 w-full max-w-none bg-transparent p-0 backdrop:bg-black/70 backdrop:backdrop-blur-sm ${SIZE_CLASSES[size]}`}
    >
      <div className="flex max-h-[90dvh] flex-col overflow-hidden rounded-t-2xl border border-surface-border bg-surface-raised shadow-2xl sm:mx-auto sm:m-auto sm:rounded-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-100">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-xs text-slate-400">{description}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface-border hover:text-slate-100"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        {/* The form body scrolls independently so a long form on a phone keeps
            its title and its submit button reachable. */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <footer className="border-t border-surface-border bg-surface/60 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}

/**
 * A stable DOM id for aria-labelledby. useId() would need this file to be a
 * Client Component (it already is), but the title is a prop that cannot change
 * identity between renders here, so a slug is enough and keeps the markup
 * readable in tests.
 */
function useIdFor(title: string): string {
  return `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;
}
