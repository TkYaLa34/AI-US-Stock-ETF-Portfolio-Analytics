'use client';

/**
 * Record a transaction: BUY / SELL, or DEPOSIT / WITHDRAWAL.
 *
 * WHY TWO TABS RATHER THAN ONE FORM WITH A TYPE DROPDOWN: the two movements
 * need disjoint fields. A trade needs an asset, a quantity, a price and a trade
 * date; a cash movement needs only an amount, and Postgres stamps
 * `trade_date = current_date` for it. Sharing one form would mean either
 * validating fields that are irrelevant to the chosen type, or leaving required
 * inputs unset.
 *
 * The tabs are separate components on purpose. `useActionState` keeps the last
 * returned state, so switching tabs in place would leave the previous tab's
 * field errors on screen. Unmounting one body and mounting the other resets
 * the state, while the surrounding <Modal> stays mounted so the dialog itself
 * does not flicker.
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
  CASH_TYPES,
  CASH_TYPE_LABELS,
  NOTES_MAX_LENGTH,
  TRADE_TYPES,
  TRADE_TYPE_LABELS,
  type AssetListItem,
  type CashType,
  type PortfolioListItem,
  type TradeType,
} from '@/lib/portfolio/types';
import {
  createCashMovementAction,
  createTradeAction,
} from '@/server/actions/transaction-actions';

import { useModalAction } from './use-modal-action';

export type TransactionMode = 'trade' | 'cash';

export interface TransactionFormModalProps {
  portfolios: readonly PortfolioListItem[];
  /** Every asset the user owns, across all of their portfolios. */
  assets: readonly AssetListItem[];
  defaultPortfolioId: string;
  defaultMode?: TransactionMode;
  onClose: () => void;
}

/**
 * Shared props for the two tab bodies. The portfolio select is controlled from
 * the parent so the chosen portfolio survives switching tabs, and so the asset
 * list can be filtered to it (see SelectField's `value`/`onChange` contract).
 */
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

const CASH_TYPE_OPTIONS: readonly SelectOption[] = CASH_TYPES.map((type) => ({
  value: type,
  label: CASH_TYPE_LABELS[type],
}));

export function TransactionFormModal({
  portfolios,
  assets,
  defaultPortfolioId,
  defaultMode = 'trade',
  onClose,
}: TransactionFormModalProps) {
  const [mode, setMode] = useState<TransactionMode>(defaultMode);
  const [portfolioId, setPortfolioId] = useState(defaultPortfolioId);

  return (
    <Modal
      title={mode === 'trade' ? 'บันทึกรายการซื้อ / ขาย' : 'บันทึกการเคลื่อนไหวเงินสด'}
      description={
        mode === 'trade'
          ? 'ระบบจะอัปเดตจำนวนถือครอง ต้นทุนเฉลี่ย และยอดเงินสดให้อัตโนมัติ'
          : 'ใช้ฝากเงินเข้าเพื่อเติมเงินก่อนซื้อ หรือถอนเงินออกจากพอร์ตโฟลิโอ'
      }
      onClose={onClose}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <ModeTabs mode={mode} onChange={setMode} />

        {mode === 'trade' ? (
          <TradeFormBody
            portfolios={portfolios}
            portfolioId={portfolioId}
            onPortfolioChange={setPortfolioId}
            assets={assets}
            onClose={onClose}
          />
        ) : (
          <CashFormBody
            portfolios={portfolios}
            portfolioId={portfolioId}
            onPortfolioChange={setPortfolioId}
            onClose={onClose}
          />
        )}
      </div>
    </Modal>
  );
}

interface ModeTabsProps {
  mode: TransactionMode;
  onChange: (mode: TransactionMode) => void;
}

/**
 * A segmented control rather than role="tablist": these two views are really two
 * different forms, and the tab pattern promises arrow-key navigation and panel
 * semantics that would be a lie here.
 */
function ModeTabs({ mode, onChange }: ModeTabsProps) {
  const tabs: readonly { value: TransactionMode; label: string }[] = [
    { value: 'trade', label: 'ซื้อ / ขาย' },
    { value: 'cash', label: 'ฝาก / ถอน' },
  ];

  return (
    <div
      role="group"
      aria-label="ประเภทรายการ"
      className="grid grid-cols-2 gap-1 rounded-lg border border-surface-border bg-surface-raised p-1"
    >
      {tabs.map((tab) => {
        const isActive = mode === tab.value;

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            aria-pressed={isActive}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-brand-600 text-white'
                : 'text-slate-300 hover:bg-surface-border hover:text-slate-100'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
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

  // Only this portfolio's holdings can be traded. record_trade re-checks it in
  // SQL (PT002), but offering the choice would just be a form of trial and error.
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
          // Safe without a mount effect: this dialog is only ever mounted from a
          // click in the browser, so it is never server-rendered and cannot
          // disagree with the client about what "today" is.
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

function CashFormBody({
  portfolios,
  portfolioId,
  onPortfolioChange,
  onClose,
}: FormBodyProps) {
  const { state, formAction } = useModalAction(
    createCashMovementAction,
    onClose,
  );

  const [transactionType, setTransactionType] = useState<CashType>('DEPOSIT');

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
          options={CASH_TYPE_OPTIONS}
          value={transactionType}
          onChange={(value) => setTransactionType(value as CashType)}
          error={state.fieldErrors.transactionType}
        />

        <FormField
          label="จำนวนเงิน"
          name="amount"
          type="number"
          inputMode="decimal"
          required
          min={0}
          step="any"
          placeholder="1000.00"
          error={state.fieldErrors.amount}
          hint="รองรับทศนิยมไม่เกิน 4 ตำแหน่ง"
        />
      </div>

      <TextareaField
        label="หมายเหตุ (ไม่บังคับ)"
        name="notes"
        maxLength={NOTES_MAX_LENGTH}
        placeholder="เช่น โอนเข้าบัญชีนายนาค..."
        error={state.fieldErrors.notes}
      />

      <FormActions
        onClose={onClose}
        pendingLabel="กำลังบันทึก..."
        submitLabel={
          transactionType === 'DEPOSIT' ? 'บันทึกการฝากเงิน' : 'บันทึกการถอนเงิน'
        }
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

/**
 * The portfolio picker is controlled so the selection outlives a tab switch:
 * both bodies unmount, and an uncontrolled <select> would snap back to the
 * first option on the way in.
 */
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

