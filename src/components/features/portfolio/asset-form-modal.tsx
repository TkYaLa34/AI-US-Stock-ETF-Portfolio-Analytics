'use client';

/**
 * Create / edit dialog for a holding.
 *
 * `portfolio_id` is a select when creating and frozen when editing:
 * updateAssetAction deliberately refuses to move an asset between portfolios,
 * because that would orphan the trades already recorded against it.
 */

import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { SelectField, type SelectOption } from '@/components/ui/select-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { TextareaField } from '@/components/ui/textarea-field';
import {
  ASSET_NAME_MAX_LENGTH,
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  EXCHANGE_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  SECTOR_MAX_LENGTH,
  type AssetListItem,
  type PortfolioListItem,
} from '@/lib/portfolio/types';
import {
  createAssetAction,
  updateAssetAction,
} from '@/server/actions/asset-actions';

import { useModalAction } from './use-modal-action';

export interface AssetFormModalProps {
  portfolios: readonly PortfolioListItem[];
  defaultPortfolioId: string;
  /** Present when editing an existing holding. */
  asset?: AssetListItem;
  onClose: () => void;
}

const ASSET_TYPE_OPTIONS: readonly SelectOption[] = ASSET_TYPES.map((type) => ({
  value: type,
  label: ASSET_TYPE_LABELS[type],
}));

export function AssetFormModal({
  portfolios,
  defaultPortfolioId,
  asset,
  onClose,
}: AssetFormModalProps) {
  const isEdit = asset !== undefined;
  const portfolioId = asset?.portfolio_id ?? defaultPortfolioId;

  const { state, formAction } = useModalAction(
    isEdit ? updateAssetAction : createAssetAction,
    onClose,
  );

  // New holdings default to the portfolio's own currency so the field rarely
  // has to be touched at all.
  const portfolio = portfolios.find((item) => item.id === portfolioId);
  const defaultCurrency = asset?.currency ?? portfolio?.base_currency ?? 'USD';

  const portfolioOptions: readonly SelectOption[] = portfolios.map((item) => ({
    value: item.id,
    label: item.is_default ? `${item.name} (ค่าเริ่มต้น)` : item.name,
  }));

  return (
    <Modal
      title={isEdit ? 'แก้ไขหลักทรัพย์' : 'เพิ่มหลักทรัพย์ใหม่'}
      description={
        isEdit
          ? 'ปรับรายละเอียดของรายการที่ถืออยู่ การเปลี่ยนจำนวนหรือต้นทุนควรใช้รายการซื้อ/ขายแทน'
          : 'เพิ่มหุ้นหรือกองทุนที่คุณถืออยู่ ระบบจะคำนวณมูลค่าให้ทันที'
      }
      onClose={onClose}
      size="lg"
    >
      <form action={formAction} noValidate className="flex flex-col gap-4">
        {isEdit ? (
          <>
            <input type="hidden" name="portfolioId" value={portfolioId} />
            <input type="hidden" name="assetId" value={asset?.id ?? ''} />
          </>
        ) : null}

        {state.message ? (
          <Alert
            tone={state.status === 'success' ? 'success' : 'error'}
            message={state.message}
            detail={state.detail}
          />
        ) : null}

        {/* Frozen while editing: updateAssetAction refuses to move an asset
            between portfolios, so offering the choice would be a lie. */}
        {isEdit ? null : (
          <SelectField
            label="พอร์ตโฟลิโอ"
            name="portfolioId"
            required
            options={portfolioOptions}
            placeholder="เลือกพอร์ตโฟลิโอ..."
            defaultValue={defaultPortfolioId}
            error={state.fieldErrors.portfolioId}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="รหัสหลักทรัพย์"
            name="symbol"
            required
            maxLength={15}
            placeholder="AAPL"
            defaultValue={asset?.symbol ?? ''}
            error={state.fieldErrors.symbol}
            hint="ตัวอักษรภาษาอังกฤษ เช่น AAPL, BRK-B"
          />

          <FormField
            label="ชื่อหลักทรัพย์"
            name="name"
            required
            maxLength={ASSET_NAME_MAX_LENGTH}
            placeholder="Apple Inc."
            defaultValue={asset?.name ?? ''}
            error={state.fieldErrors.name}
          />

          <SelectField
            label="ประเภท"
            name="assetType"
            required
            options={ASSET_TYPE_OPTIONS}
            placeholder="เลือกประเภท..."
            defaultValue={asset?.asset_type ?? 'stock'}
            error={state.fieldErrors.assetType}
          />

          <FormField
            label="ตลาด (ไม่บังคับ)"
            name="exchange"
            maxLength={EXCHANGE_MAX_LENGTH}
            placeholder="NASDAQ"
            defaultValue={asset?.exchange ?? ''}
            error={state.fieldErrors.exchange}
          />

          <FormField
            label="กลุ่มอุตสาหกรรม (ไม่บังคับ)"
            name="sector"
            maxLength={SECTOR_MAX_LENGTH}
            placeholder="Technology"
            defaultValue={asset?.sector ?? ''}
            error={state.fieldErrors.sector}
          />

          <FormField
            label="สกุลเงิน"
            name="currency"
            required
            maxLength={3}
            placeholder="USD"
            defaultValue={defaultCurrency}
            error={state.fieldErrors.currency}
          />

          <FormField
            label="จำนวนหุ้น/หน่วย"
            name="quantity"
            type="number"
            inputMode="decimal"
            required
            min={0}
            step="any"
            defaultValue={asset?.quantity ?? ''}
            error={state.fieldErrors.quantity}
          />

          <FormField
            label="ต้นทุนต่อหน่วย"
            name="averageCost"
            type="number"
            inputMode="decimal"
            required
            min={0}
            step="any"
            defaultValue={asset?.average_cost ?? ''}
            error={state.fieldErrors.averageCost}
          />

          <FormField
            label="ราคาปัจจุบัน (ไม่บังคับ)"
            name="currentPrice"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="เว้นว่างไว้หากยังไม่มีราคาล่าสุด"
            defaultValue={asset?.current_price ?? ''}
            error={state.fieldErrors.currentPrice}
            hint="ใช้คำนวณกำไร/ขาดทุนที่ยังไม่จำนวน ถ้าเว้นว่างระบบจะใช้ต้นทุนต่อหน่วยแทน"
          />
        </div>

        <TextareaField
          label="หมายเหตุ (ไม่บังคับ)"
          name="notes"
          maxLength={NOTES_MAX_LENGTH}
          placeholder="กลยุทธ์, เหตุผลที่ซื้อ..."
          defaultValue={asset?.notes ?? ''}
          error={state.fieldErrors.notes}
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
              pendingLabel={isEdit ? 'กำลังบันทึก...' : 'กำลังเพิ่ม...'}
              fullWidth={false}
            >
              {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มหลักทรัพย์'}
            </SubmitButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}

