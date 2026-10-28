'use client';

/**
 * Institutional & Insider Money Flow Tracker Component.
 *
 * Institutional dark slate theme (#0a0e17):
 * 1. Visual Institutional Accumulation Bar (Net Buy % vs Net Sell %).
 * 2. Unusual Volume / Dark Pool Activity Alerts badge.
 * 3. Insider Trading Summary (recent CEO/Director buy/sell transactions).
 */

import { Landmark, ArrowUpRight, ArrowDownRight, ShieldCheck, Eye, Layers } from 'lucide-react';
import type { MoneyFlowData } from '@/server/actions/symbol-search-actions';

export interface InstitutionalMoneyFlowTrackerProps {
  symbol: string;
  moneyFlow?: MoneyFlowData;
}

export function InstitutionalMoneyFlowTracker({
  symbol,
  moneyFlow,
}: InstitutionalMoneyFlowTrackerProps) {
  if (!moneyFlow) return null;

  const {
    institutionalBuyPercent,
    institutionalSellPercent,
    netFlowStatus,
    darkPoolVolumeAlert,
    insiderTransactions,
  } = moneyFlow;

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Heavy Accumulation':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Moderate Accumulation':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      case 'Net Outflow':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0a0e17] p-5 md:p-6 shadow-2xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-purple-600/30 to-brand-600/20 border border-purple-500/30 p-2.5 text-purple-300">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white tracking-wide">
                Institutional & Insider Money Flow Tracker
              </h3>
              <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 uppercase">
                {symbol} • Block Trading & SEC Form 4
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ติดตามการสะสมหุ้นของกองทุนสถาบัน คำสั่งซื้อขายบิ๊กล็อตนอกกระดาน (Dark Pool) และรายการผู้บริหาร
            </p>
          </div>
        </div>

        {/* Accumulation Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs font-semibold">Institutional Status:</span>
          <span
            className={`rounded-lg border px-3 py-1 text-xs font-extrabold flex items-center gap-1.5 shadow-sm ${getStatusBadgeClass(
              netFlowStatus,
            )}`}
          >
            <Layers className="h-3.5 w-3.5" />
            {netFlowStatus}
          </span>
        </div>
      </div>

      {/* Grid: Accumulation Meter & Dark Pool Alert Badge */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        {/* 1. Visual Institutional Accumulation Bar (2 cols) */}
        <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <div className="flex justify-between items-center font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Landmark className="h-4 w-4 text-emerald-400" />
              สัดส่วนคำสั่งซื้อ/ขายเงินทุนสถาบัน (Institutional Buy vs Sell Ratio)
            </span>
            <span className="text-xs font-bold text-emerald-400">
              {institutionalBuyPercent}% Accumulation
            </span>
          </div>

          {/* Visual Accumulation Bar */}
          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden flex border border-slate-800 p-0.5">
            <div
              className="bg-emerald-500 h-full rounded-l-full transition-all duration-700"
              style={{ width: `${institutionalBuyPercent}%` }}
              title={`Institutional Buy: ${institutionalBuyPercent}%`}
            />
            <div
              className="bg-rose-500 h-full rounded-r-full transition-all duration-700"
              style={{ width: `${institutionalSellPercent}%` }}
              title={`Institutional Sell: ${institutionalSellPercent}%`}
            />
          </div>

          <div className="flex justify-between text-[11px] font-semibold">
            <span className="text-emerald-400 flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5" /> Buy Volume: {institutionalBuyPercent}%
            </span>
            <span className="text-rose-400 flex items-center gap-1">
              Sell Volume: {institutionalSellPercent}% <ArrowDownRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* 2. Unusual Volume / Dark Pool Activity Alert Card */}
        <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
            <span className="font-bold text-purple-300 flex items-center gap-1.5 text-xs">
              <Eye className="h-4 w-4 text-purple-400" /> Dark Pool Activity
            </span>
            <span className="rounded bg-purple-500/20 text-purple-300 px-2 py-0.5 text-[10px] font-bold border border-purple-500/30">
              ALERT
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block font-medium">
              ปริมาณการซื้อขายบิ๊กล็อตนอกกระดาน:
            </span>
            <span className="text-base font-extrabold text-white mt-0.5 block">
              {darkPoolVolumeAlert.volumePercentAboveAvg}
            </span>
          </div>

          <div className="rounded bg-slate-950/80 p-2 border border-purple-500/30 text-[10px] text-purple-200 font-semibold leading-relaxed">
            {darkPoolVolumeAlert.alertLabel}
          </div>
        </div>
      </div>

      {/* 3. Insider Trading Summary Table */}
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-brand-400" />
            รายการซื้อขายของผู้บริหารและกรรมการ (SEC Form 4 Insider Summary)
          </h4>
          <span className="text-[11px] text-slate-400 font-medium">อัปเดตล่าสุด 30 วัน</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                <th className="pb-2 font-medium">ชื่อผู้รายงาน (Insider)</th>
                <th className="pb-2 font-medium">ตำแหน่ง (Title)</th>
                <th className="pb-2 font-medium text-center">ประเภท</th>
                <th className="pb-2 font-medium text-right">จำนวนหุ้น</th>
                <th className="pb-2 font-medium text-right">ราคา/หุ้น</th>
                <th className="pb-2 font-medium text-right">มูลค่ารวม</th>
                <th className="pb-2 font-medium text-right">วันที่ทำรายการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {insiderTransactions.map((tx, idx) => (
                <tr key={`${tx.reportingName}-${idx}`} className="hover:bg-slate-950/50">
                  <td className="py-2.5 font-bold text-slate-100">{tx.reportingName}</td>
                  <td className="py-2.5 text-slate-400">{tx.typeOfOwner}</td>
                  <td className="py-2.5 text-center">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        tx.transactionType === 'Buy'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {tx.transactionType === 'Buy' ? '+ Buy' : '- Sell'}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-200">{tx.shares}</td>
                  <td className="py-2.5 text-right font-medium text-slate-300">{tx.price}</td>
                  <td className="py-2.5 text-right font-bold text-white">{tx.totalValue}</td>
                  <td className="py-2.5 text-right text-slate-400 font-mono text-[11px]">
                    {tx.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
