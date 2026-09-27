/**
 * Horizontal bar list for an allocation breakdown.
 *
 * Deliberately NOT a charting library: a stacked bar per asset type is three
 * divs and a percentage, and a real chart dependency would be several hundred
 * kilobytes to draw the same shape. The data comes from
 * src/lib/portfolio/analytics.ts as AllocationSlice[], already sorted and
 * already converted to 0..1, so this component only has to render it.
 *
 * The bar is marked aria-hidden and the percentage is spelled out in text, so
 * the information does not depend on being able to see the graphic.
 */

import { formatAllocationPercent, formatMoney } from '@/lib/portfolio/format';
import type { AllocationSlice } from '@/lib/portfolio/analytics';

export interface AllocationListProps {
  title: string;
  slices: readonly AllocationSlice[];
  currency: string;
  /** Slices below this share are collapsed into a single "other" row. */
  maxVisible?: number;
}

/**
 * A fixed hue ramp rather than random colours: two runs of the same portfolio
 * must paint the same asset type the same colour, otherwise the chart cannot be
 * compared against itself over time.
 */
const BAR_COLOURS = [
  'bg-brand-500',
  'bg-brand-400',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-slate-500',
] as const;

function colourFor(index: number): string {
  return (
    BAR_COLOURS[index % BAR_COLOURS.length] ?? 'bg-slate-500'
  );
}

export function AllocationList({
  title,
  slices,
  currency,
  maxVisible = 6,
}: AllocationListProps) {
  if (slices.length === 0) {
    return (
      <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">ยังไม่มีข้อมูลการจัดสรร</p>
      </section>
    );
  }

  const visible = slices.slice(0, maxVisible);
  const overflow = slices.slice(maxVisible);
  // The hidden slices are still real money, so they get an honest tail row
  // rather than silently vanishing from the percentages.
  const overflowValue = overflow.reduce((sum, slice) => sum + slice.marketValue, 0);
  const rows = [
    ...visible,
    ...(overflow.length > 0
      ? [
          {
            key: '__overflow__',
            label: `อื่นๆ (${overflow.length} รายการ)`,
            marketValue: overflowValue,
            percent: overflow.reduce((sum, slice) => sum + slice.percent, 0),
          },
        ]
      : []),
  ];

  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>

      <ul className="mt-3 flex flex-col gap-3">
        {rows.map((slice, index) => (
          <li key={slice.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-slate-300">{slice.label}</span>
              <span className="shrink-0 tabular-nums text-slate-400">
                {formatAllocationPercent(slice.percent)} ·{' '}
                {formatMoney(slice.marketValue, currency)}
              </span>
            </div>

            <div
              aria-hidden="true"
              className="h-2 w-full overflow-hidden rounded-full bg-surface-border"
            >
              <div
                className={`h-full rounded-full ${colourFor(index)}`}
                style={{ width: `${Math.max(slice.percent * 100, 0).toFixed(2)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
