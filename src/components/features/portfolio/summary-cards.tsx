/**
 * The 4 metric cards at the top of the dashboard.
 *
 * Displays key investment metrics:
 * 1. Total Portfolio Value
 * 2. Market Value (with cost basis)
 * 3. Total Unrealized Gain/Loss (with percentage & green/red tone)
 * 4. Active Asset Count
 */

import {
  formatMoney,
  formatPercentOrDash,
  formatSignedMoney,
} from '@/lib/portfolio/format';
import type { PortfolioSummary } from '@/lib/portfolio/analytics';

export interface SummaryCardsProps {
  summary: PortfolioSummary;
}

interface MetricCardProps {
  label: string;
  value: string;
  secondary?: string;
  tone?: 'default' | 'positive' | 'negative';
}

const TONE_CLASSES: Record<NonNullable<MetricCardProps['tone']>, string> = {
  default: 'text-slate-100',
  positive: 'text-emerald-400',
  negative: 'text-red-400',
};

function MetricCard({ label, value, secondary, tone = 'default' }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-surface-border bg-surface-raised px-4 py-3.5 shadow-sm transition-all hover:border-slate-700">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={`text-xl font-bold tabular-nums sm:text-2xl ${TONE_CLASSES[tone]}`}
      >
        {value}
      </p>
      {secondary ? (
        <p className="text-xs tabular-nums text-slate-400">{secondary}</p>
      ) : null}
    </div>
  );
}

function pnlTone(value: number): NonNullable<MetricCardProps['tone']> {
  if (value > 0) {
    return 'positive';
  }
  if (value < 0) {
    return 'negative';
  }
  return 'default';
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const { currency } = summary;

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="มูลค่ารวมทั้งหมด"
        value={formatMoney(summary.totalValue, currency)}
        secondary={`เงินสดพร้อมเทรด ${formatMoney(summary.cashBalance, currency)}`}
      />

      <MetricCard
        label="มูลค่าหลักทรัพย์"
        value={formatMoney(summary.marketValue, currency)}
        secondary={`ต้นทุนรวม ${formatMoney(summary.costBasis, currency)}`}
      />

      <MetricCard
        label="กำไร / ขาดทุนรวม"
        value={formatSignedMoney(summary.unrealizedPnl, currency)}
        secondary={formatPercentOrDash(summary.unrealizedPnlPercent)}
        tone={pnlTone(summary.unrealizedPnl)}
      />

      <MetricCard
        label="จำนวนหลักทรัพย์ที่ถือครอง"
        value={`${summary.positionCount} รายการ`}
        secondary="หุ้น & กองทุน ETF ที่ลงทุนอยู่"
      />
    </div>
  );
}
