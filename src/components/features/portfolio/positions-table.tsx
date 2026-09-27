/**
 * The holdings table.
 *
 * RESPONSIVE STRATEGY (mobile first, per .clinerules section 3): below `sm` a
 * seven-column table cannot fit, so each holding renders as a stacked card. From
 * `sm` up the same data renders as a real <table> with a header row, which is
 * what a screen reader user actually wants to navigate.
 *
 * Both renderings come from the same list, so they cannot drift apart. Cells use
 * <th scope="col"> because this is tabular data and assistive tech should be
 * able to associate a value with its heading.
 */

import type { ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

import {
  formatMoney,
  formatPercentOrDash,
  formatQuantity,
  formatSignedMoney,
} from '@/lib/portfolio/format';
import { ASSET_TYPE_LABELS, type AssetType } from '@/lib/portfolio/types';
import type { PositionView } from '@/lib/portfolio/analytics';

export interface PositionsTableProps {
  positions: readonly PositionView[];
  currency: string;
  onEdit: (assetId: string) => void;
  onDelete: (assetId: string) => void;
}

/**o
 * Falls back to the raw value rather than rendering an empty cell, so a type
 * added by a newer migration still shows something sensible.
 */
function assetTypeLabel(assetType: string): string {
  return ASSET_TYPE_LABELS[assetType as AssetType] ?? assetType;
}

function pnlClassName(value: number): string {
  if (value > 0) {
    return 'text-emerald-300';
  }
  if (value < 0) {
    return 'text-red-300';
  }
  return 'text-slate-400';
}

interface RowActionProps {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  danger?: boolean;
}

function RowAction({ label, onClick, icon, danger = false }: RowActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-lg border border-surface-border bg-surface-raised p-1.5 transition-colors ${
        danger
          ? 'text-slate-400 hover:border-red-500/60 hover:text-red-300'
          : 'text-slate-400 hover:border-brand-500 hover:text-brand-300'
      }`}
    >
      {icon}
    </button>
  );
}

export function PositionsTable({
  positions,
  currency,
  onEdit,
  onDelete,
}: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-surface-border bg-surface-raised p-6 text-center">
        <p className="text-sm text-slate-400">
          ยังไม่มีหลักทรัพย์ในพอร์ตโฟลิโอนี้
        </p>
        <p className="mt-1 text-xs text-slate-500">
          เพิ่มหลักทรัพย์ก่อน หรือบันทึกรายการซื้อเพื่อสร้างรายการที่ถือครอง
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: one card per holding. */}
      <ul className="flex flex-col gap-3 sm:hidden">
        {positions.map((position) => (
          <li
            key={position.asset.id}
            className="flex flex-col gap-2 rounded-xl border border-surface-border bg-surface-raised p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {position.asset.symbol}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {position.asset.name}
                </p>
              </div>
              <span className="shrink-0 rounded bg-surface-border px-1.5 py-0.5 text-[10px] text-slate-300">
                {assetTypeLabel(position.asset.asset_type)}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <div>
                <dt className="text-slate-500">จำนวน</dt>
                <dd className="tabular-nums text-slate-300">
                  {formatQuantity(position.asset.quantity)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">ต้นทุน/หน่วย</dt>
                <dd className="tabular-nums text-slate-300">
                  {formatMoney(position.asset.average_cost, currency)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">มูลค่า</dt>
                <dd className="tabular-nums text-slate-300">
                  {formatMoney(position.marketValue, currency)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">กำไร/ขาดทุน</dt>
                <dd
                  className={`tabular-nums ${pnlClassName(position.unrealizedPnl)}`}
                >
                  {formatSignedMoney(position.unrealizedPnl, currency)}
                  <span className="ml-1 text-[10px]">
                    {formatPercentOrDash(position.unrealizedPnlPercent)}
                  </span>
                </dd>
              </div>
            </dl>

            <div className="flex gap-2 pt-1">
              <RowAction
                label={`แก้ไข ${position.asset.symbol}`}
                onClick={() => onEdit(position.asset.id)}
                icon={<Pencil aria-hidden="true" className="h-3.5 w-3.5" />}
              />
              <RowAction
                label={`ลบ ${position.asset.symbol}`}
                onClick={() => onDelete(position.asset.id)}
                icon={<Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
                danger
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: a real table. */}
      <div className="hidden overflow-x-auto rounded-xl border border-surface-border bg-surface-raised sm:block">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="border-b border-surface-border text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">หลักทรัพย์</th>
              <th scope="col" className="px-4 py-3 font-medium">ประเภท</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">จำนวน</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">ต้นทุน/หน่วย</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">ราคาปัจจุบัน</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">มูลค่า</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">กำไร/ขาดทุน</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                <span className="sr-only">จัดการ</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-surface-border">
            {positions.map((position) => (
              <tr key={position.asset.id} className="hover:bg-surface/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-100">
                    {position.asset.symbol}
                  </p>
                  <p className="text-xs text-slate-400">{position.asset.name}</p>
                  {position.asset.sector ? (
                    <p className="text-[11px] text-slate-500">
                      {position.asset.sector}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-xs text-slate-300">
                  {assetTypeLabel(position.asset.asset_type)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                  {formatQuantity(position.asset.quantity)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                  {formatMoney(position.asset.average_cost, currency)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                  {position.asset.current_price === null ? (
                    <span className="text-amber-400/90" title="ยังไม่มีราคาล่าสุด">
                      ไม่มีราคาล่าสุด
                    </span>
                  ) : (
                    formatMoney(position.asset.current_price, currency)
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-100">
                  {formatMoney(position.marketValue, currency)}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${pnlClassName(position.unrealizedPnl)}`}
                >
                  {formatSignedMoney(position.unrealizedPnl, currency)}
                  <span className="ml-1 text-[11px]">
                    {formatPercentOrDash(position.unrealizedPnlPercent)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <RowAction
                      label={`แก้ไข ${position.asset.symbol}`}
                      onClick={() => onEdit(position.asset.id)}
                      icon={<Pencil aria-hidden="true" className="h-3.5 w-3.5" />}
                    />
                    <RowAction
                      label={`ลบ ${position.asset.symbol}`}
                      onClick={() => onDelete(position.asset.id)}
                      icon={<Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
                      danger
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

