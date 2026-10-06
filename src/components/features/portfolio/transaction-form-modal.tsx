'use client';

/**
 * Record a transaction: BUY / SELL trades.
 *
 * LEDGER IS APPEND ONLY: there is no edit or delete. A mistake is corrected by
 * recording an offsetting trade, so the numbers always tell the truth about
 * what was actually done. See src/server/actions/transaction-actions.ts.
 */

import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { SelectField, type SelectOption } from '@/components/ui/select-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { TextareaField } from '@/components/ui/textarea-field';
import { formatQuantity, todayAsDateInputValue } from '@/lib/portfolio/format';
import {
  NOTES_MAX_LENGTH,
  TRADE_TYPES,
  TRADE_TYPE_LABELS,
  type AssetListItem,
  type PortfolioListItem,
  type TradeType,
} from '@/lib/portfolio/types';
import { createTradeAction } from '@/server/actions/transaction-actions';

import { useModalAction } from './use-modal-action';

export interface TransactionFormModalProps {
  portfolios: readonly PortfolioListItem[];
  /** Every asset the user owns, across all of their portfolios. */
  assets: readonly AssetListItem[];
  defaultPortfolioId: string;
  onClose: () => void;
}

interface FormBodyProps {
  portfolios: readonly PortfolioListItem[];
  portfolioId: string;
  onPortfolioChange: (value: string) => void;
  onClose: () => void;
}

interface TradeFormBodyProps extends FormBodyProps {
  assets: readonly AssetListItem[];
}

const TRADE_TYPE_OPTIONS: readonly SelectOption[] = TRADE_TYPES.map((type) => ({
  value: type,
  label: TRADE_TYPE_LABELS[type],
}));

export function TransactionFormModal({
  portfolios,
  assets,
  defaultPortfolioId,
  onClose,
}: TransactionFormModalProps) {
  const [portfolioId, setPortfolioId] = useState(defaultPortfolioId);

  return (
    <Modal
      title="บันทึกรายการซื้อ / ขาย"
      description="ระบบจะอัปเดตจำนวนถือครอง ต้นทุนเฉลี่ย และยอดเงินสดให้อัตโนมัติ"
      onClose={onClose}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <TradeFormBody
          portfolios={portfolios}
          portfolioId={portfolioId}
          onPortfolioChange={setPortfolioId}
          assets={assets}
          onClose={onClose}
        />
      </div>
    </Modal>
  );
}

function TradeFormBody({
  portfolios,
  portfolioId,
  onPortfolioChange,
  assets,
  onClose,
}: TradeFormBodyProps) {
  const { state, formAction } = useModalAction(createTradeAction, onClose);

  const [transactionType, setTransactionType] = useState<TradeType>('BUY');

  // Only this portfolio's holdings can be traded. record_trade re-checks it in SQL (PT002).
  const availableAssets = assets.filter(
    (asset) => asset.portfolio_id === portfolioId,
  );

  const assetOptions: readonly SelectOption[] = availableAssets.map((asset) => ({
    value: asset.id,
    label: `${asset.symbol} — ${asset.name} (ถือ ${formatQuantity(asset.quantity)} หน่วย)`,
  }));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <PortfolioField
        portfolios={portfolios}
        portfolioId={portfolioId}
        onPortfolioChange={onPortfolioChange}
        error={state.fieldErrors.portfolioId}
      />

      {state.message ? (
        <Alert
          tone={state.status === 'success' ? 'success' : 'error'}
          message={state.message}
          detail={state.detail}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="ประเภทรายการ"
          name="transactionType"
          required
          options={TRADE_TYPE_OPTIONS}
          value={transactionType}
          onChange={(value) => setTransactionType(value as TradeType)}
          error={state.fieldErrors.transactionType}
        />

        <SelectField
          label="หลักทรัพย์"
          name="assetId"
          required
          options={assetOptions}
          placeholder={
            availableAssets.length === 0
              ? 'ยังไม่มีหลักทรัพย์ในพอร์ตโฟลิโอนี้'
              : 'เลือกหลักทรัพย์...'
          }
          disabled={availableAssets.length === 0}
          error={state.fieldErrors.assetId}
        />

        <FormField
          label="จำนวน"
          name="quantity"
          type="number"
          inputMode="decimal"
          required
          min={0}
          step="any"
          placeholder="10"
          error={state.fieldErrors.quantity}
        />

        <FormField
          label="ราคาต่อหน่วย"
          name="price"
          type="number"
          inputMode="decimal"
          required
          min={0}
          step="any"
          placeholder="189.50"
          error={state.fieldErrors.price}
        />

        <FormField
          label="ค่าธรรมเนียม"
          name="fees"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          placeholder="0.00"
          error={state.fieldErrors.fees}
          hint="เว้นว่างไว้หากไม่มีค่าธรรมเนียม"
        />

        <FormField
          label="วันที่ทำรายการ"
          name="tradeDate"
          type="date"
          required
          defaultValue={todayAsDateInputValue()}
          max={todayAsDateInputValue()}
          error={state.fieldErrors.tradeDate}
        />
      </div>

      <TextareaField
        label="หมายเหตุ (ไม่บังคับ)"
        name="notes"
        maxLength={NOTES_MAX_LENGTH}
        placeholder="เหตุผลที่ซื้อ/ขาย..."
        error={state.fieldErrors.notes}
      />

      <FormActions
        onClose={onClose}
        pendingLabel="กำลังบันทึก..."
        submitLabel={transactionType === 'BUY' ? 'บันทึกการซื้อ' : 'บันทึกการขาย'}
      />
    </form>
  );
}

interface PortfolioFieldProps {
  portfolios: readonly PortfolioListItem[];
  portfolioId: string;
  onPortfolioChange: (value: string) => void;
  error?: string;
}

function PortfolioField({
  portfolios,
  portfolioId,
  onPortfolioChange,
  error,
}: PortfolioFieldProps) {
  const options: readonly SelectOption[] = portfolios.map((item) => ({
    value: item.id,
    label: item.is_default ? `${item.name} (ค่าเริ่มต้น)` : item.name,
  }));

  return (
    <SelectField
      label="พอร์ตโฟลิโอ"
      name="portfolioId"
      required
      options={options}
      value={portfolioId}
      onChange={onPortfolioChange}
      error={error}
    />
  );
}

interface FormActionsProps {
  onClose: () => void;
  pendingLabel: string;
  submitLabel: string;
}

function FormActions({ onClose, pendingLabel, submitLabel }: FormActionsProps) {
  return (
    <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-surface-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600"
      >
        ยกเลิก
      </button>

      <div className="sm:w-44">
        <SubmitButton pendingLabel={pendingLabel} fullWidth={false}>
          {submitLabel}
        </SubmitButton>
      </div>
    </div>
  );
}
