/**
 * The four numbers at the top of the dashboard.
 *
 * Presentational only - no 'use client'. It is pulled into the client bundle
 * anyway by DashboardShell, but keeping it free of hooks means the same shape
 * could be rendered straight from a Server Component if the layout changes.
 *
 * A null `unrealizedPnlPercent` renders as "-" rather than 0.00%, because the
 * analytics layer only returns null when there is genuinely no cost basis to
 * divide by - see formatPercentOrDash.
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
  positive: 'text-emerald-300',
  negative: 'text-red-300',
};

function MetricCard({ label, value, secondary, tone = 'default' }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-surface-border bg-surface-raised px-4 py-3">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums sm:text-xl ${TONE_CLASSES[tone]}`}
      >
        {value}
      </p>
      {secondary ? (
        <p className="text-xs tabular-nums text-slate-400">{secondary}</p>
      ) : null}
    </div>
  );
}

/** Green for a gain, red for a loss, neutral for exactly break-even. */
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="มูลค่ารวมทั้งหมด"
        value={formatMoney(summary.totalValue, currency)}
        secondary={`${summary.positionCount} รายการที่ถือครอง`}
      />

      <MetricCard
        label="มูลค่าหลักทรัพย์"
        value={formatMoney(summary.marketValue, currency)}
        secondary={`ต้นทุน ${formatMoney(summary.costBasis, currency)}`}
      />

      <MetricCard
        label="เงินสดคงเหลือ"
        value={formatMoney(summary.cashBalance, currency)}
        secondary="ยอดเงินสดคงเหลือสำหรับส่งคำสั่งซื้อ"
      />

      <MetricCard
        label="กำไร/ขาดทุนที่ยังไม่จำนวน"
        value={formatSignedMoney(summary.unrealizedPnl, currency)}
        secondary={formatPercentOrDash(summary.unrealizedPnlPercent)}
        tone={pnlTone(summary.unrealizedPnl)}
      />
    </div>
  );
}
