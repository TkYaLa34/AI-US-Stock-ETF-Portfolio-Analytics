'use client';

/**
 * Create / edit dialog for a portfolio.
 *
 * `cash_balance` is deliberately absent: it is moved by DEPOSIT / WITHDRAWAL
 * transactions, so letting it be typed here would let the ledger and the
 * balance disagree.
 */

import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { SubmitButton } from '@/components/ui/submit-button';
import { TextareaField } from '@/components/ui/textarea-field';
import {
  DESCRIPTION_MAX_LENGTH,
  PORTFOLIO_NAME_MAX_LENGTH,
  type PortfolioListItem,
} from '@/lib/portfolio/types';
import {
  createPortfolioAction,
  updatePortfolioAction,
} from '@/server/actions/portfolio-actions';

import { useModalAction } from './use-modal-action';

export interface PortfolioFormModalProps {
  /** Present when editing, absent when creating. */
  portfolio?: PortfolioListItem;
  onClose: () => void;
}

export function PortfolioFormModal({
  portfolio,
  onClose,
}: PortfolioFormModalProps) {
  const isEdit = portfolio !== undefined;

  // The action is chosen before useActionState, which is fine: `portfolio` is a
  // prop and cannot change while the modal is mounted.
  const { state, formAction } = useModalAction(
    isEdit ? updatePortfolioAction : createPortfolioAction,
    onClose,
  );

  return (
    <Modal
      title={isEdit ? 'แก้ไขพอร์ตโฟลิโอ' : 'สร้างพอร์ตโฟลิโอใหม่'}
      description={
        isEdit
          ? 'เปลี่ยนชื่อ รายละเอียด หรือสกุลเงินหลักของพอร์ตโฟลิโอนี้'
          : 'พอร์ตโฟลิโอใหม่จะเริ่มต้นด้วยเงินสด 0 และคุณสามารถเพิ่มหลักทรัพย์ได้ทันที'
      }
      onClose={onClose}
    >
      <form action={formAction} noValidate className="flex flex-col gap-4">
        {isEdit ? (
          <input type="hidden" name="portfolioId" value={portfolio.id} />
        ) : null}

        {state.message ? (
          <Alert
            tone={state.status === 'success' ? 'success' : 'error'}
            message={state.message}
            detail={state.detail}
          />
        ) : null}

        <FormField
          label="ชื่อพอร์ตโฟลิโอ"
          name="name"
          required
          maxLength={PORTFOLIO_NAME_MAX_LENGTH}
          placeholder="Growth Portfolio"
          defaultValue={portfolio?.name ?? ''}
          error={state.fieldErrors.name}
        />

        <FormField
          label="สกุลเงินหลัก"
          name="baseCurrency"
          required
          maxLength={3}
          placeholder="USD"
          defaultValue={portfolio?.base_currency ?? 'USD'}
          hint="รหัสสกุลเงิน 3 ตัวอักษร เช่น USD, THB"
          error={state.fieldErrors.baseCurrency}
        />

        <TextareaField
          label="รายละเอียด (ไม่บังคับ)"
          name="description"
          maxLength={DESCRIPTION_MAX_LENGTH}
          placeholder="พอร์ตโฟลิโอสำหรับลงทุนระยะยาว"
          defaultValue={portfolio?.description ?? ''}
          error={state.fieldErrors.description}
        />

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-surface-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600"
          >
            ยกเลิก
          </button>

          <div className="sm:w-44">
            <SubmitButton
              pendingLabel={isEdit ? 'กำลังบันทึก...' : 'กำลังสร้าง...'}
              fullWidth={false}
            >
              {isEdit ? 'บันทึกการแก้ไข' : 'สร้างพอร์ตโฟลิโอ'}
            </SubmitButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
