'use client';

/**
 * Confirmation dialog for destructive actions.
 *
 * The dialog existing IS the confirmation: it is only mounted after the user
 * has clicked a delete button, and it spells out what the cascade will destroy
 * (for a portfolio, that is every asset and every transaction inside it).
 */

import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { SubmitButton } from '@/components/ui/submit-button';

import { useModalAction, type PortfolioServerAction } from './use-modal-action';

export interface ConfirmDialogProps {
  title: string;
  /** Say what will be lost, not just what will be deleted. */
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  action: PortfolioServerAction;
  /** Hidden inputs carrying the row id, e.g. { portfolioId: '...' }. */
  fields: Record<string, string>;
  onClose: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pendingLabel,
  action,
  fields,
  onClose,
}: ConfirmDialogProps) {
  const { state, formAction } = useModalAction(action, onClose);

  return (
    <Modal title={title} description={description} onClose={onClose} size="md">
      <form action={formAction} className="flex flex-col gap-4">
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

        {state.message ? (
          <Alert
            tone={state.status === 'success' ? 'success' : 'error'}
            message={state.message}
            detail={state.detail}
          />
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-surface-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600"
          >
            ยกเลิก
          </button>

          <div className="sm:w-40">
            <SubmitButton pendingLabel={pendingLabel} fullWidth={false}>
              {confirmLabel}
            </SubmitButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
