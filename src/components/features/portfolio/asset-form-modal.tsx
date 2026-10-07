'use client';

/**
 * Create / edit dialog for a holding.
 *
 * Includes integrated SymbolSearch for selecting US stocks and ETFs, auto-populating
 * symbol, name, exchange, and asset type.
 */

import { useState } from 'react';

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
import type { MarketSymbolResult } from '@/server/actions/symbol-search-actions';

import { SymbolSearch } from './symbol-search';
import { useModalAction } from './use-modal-action';

export interface AssetFormModalProps {
  portfolios: readonly PortfolioListItem[];
  defaultPortfolioId: string;
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

  const [symbol, setSymbol] = useState(asset?.symbol ?? '');
  const [name, setName] = useState(asset?.name ?? '');
  const [assetType, setAssetType] = useState(asset?.asset_type ?? 'stock');
  const [exchange, setExchange] = useState(asset?.exchange ?? '');
  const [currency, setCurrency] = useState(asset?.currency ?? 'USD');

  const handleSymbolSelect = (item: MarketSymbolResult) => {
    setSymbol(item.symbol);
    setName(item.name);
    setAssetType(item.assetType);
    setExchange(item.exchange);
    setCurrency(item.currency);
  };

  const portfolio = portfolios.find((item) => item.id === portfolioId);
  const defaultCurrency = currency || portfolio?.base_currency || 'USD';

  const portfolioOptions: readonly SelectOption[] = portfolios.map((item) => ({
    value: item.id,
    label: item.is_default ? `${item.name} (ค่าเริ่มต้น)` : item.name,
  }));

  return (
    <Modal
      title={isEdit ? 'แก้ไขหลักทรัพย์' : 'เพิ่มหลักทรัพย์ใหม่ (หุ้น / ETF)'}
      description={
        isEdit
          ? 'ปรับรายละเอียดของรายการที่ถืออยู่ การเปลี่ยนจำนวนหรือต้นทุนควรใช้รายการซื้อ/ขายแทน'
          : 'ค้นหาและเลือกหุ้นหรือ ETF จากตลาดสหรัฐฯ'
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

        {/* Symbol Quick Search */}
        {!isEdit ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300">
              ค้นหาชื่อหุ้นหรือ ETF อัตโนมัติ
            </label>
            <SymbolSearch onSelectSymbol={handleSymbolSelect} />
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="รหัสหลักทรัพย์"
            name="symbol"
            required
            maxLength={15}
            placeholder="AAPL"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            error={state.fieldErrors.symbol}
            hint="ตัวอักษรภาษาอังกฤษ เช่น AAPL, BRK-B"
          />

          <FormField
            label="ชื่อหลักทรัพย์"
            name="name"
            required
            maxLength={ASSET_NAME_MAX_LENGTH}
            placeholder="Apple Inc."
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={state.fieldErrors.name}
          />

          <SelectField
            label="ประเภท"
            name="assetType"
            required
            options={ASSET_TYPE_OPTIONS}
            value={assetType}
            onChange={(val) => setAssetType(val)}
            error={state.fieldErrors.assetType}
          />

          <FormField
            label="ตลาด (ไม่บังคับ)"
            name="exchange"
            maxLength={EXCHANGE_MAX_LENGTH}
            placeholder="NASDAQ"
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
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
            value={defaultCurrency}
            onChange={(e) => setCurrency(e.target.value)}
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
