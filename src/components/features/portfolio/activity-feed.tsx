/**
 * Recent ledger activity, newest first.
 *
 * READ ONLY, and that is not an oversight: the ledger is append only from the
 * UI (see src/app/actions/transaction-actions.ts). There are no edit or delete
 * buttons here, so a user who mis-typed a trade is never offered a "fix" that
 * would silently rewrite history. The way to correct a mistake is to record an
 * offsetting trade, which leaves both rows visible.
 *
 * CASH MOVEMENTS ARE TOLD APART FROM TRADES because they have no instrument: a
 * row with no symbol and a quantity of "-" is a DEPOSIT or WITHDRAWAL, and
 * labelling it "ซื้อ" would be wrong.
 */

import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';

import { formatDateOnly, formatMoney, formatQuantity } from '@/lib/portfolio/format';
import {
  CASH_TYPE_LABELS,
  TRADE_TYPE_LABELS,
  isCashTransaction,
  type CashType,
  type TradeType,
  type TransactionListItem,
} from '@/lib/portfolio/types';

export interface ActivityFeedProps {
  transactions: readonly TransactionListItem[];
  currency: string;
  /** Rendered when the portfolio has no ledger rows at all. */
  emptyHint: string;
}

interface LedgerRow {
  id: string;
  typeLabel: string;
  tone: 'buy' | 'sell' | 'cash-in' | 'cash-out';
  symbol: string;
  detail: string;
  amount: string;
  date: string;
  notes: string | null;
}

/**
 * Maps one ledger row onto everything the view needs, in one place, so the icon
 * / colour / label can never disagree with each other.
 *
 * The cast to TradeType / CashType is safe because `isCashTransaction` has
 * already excluded the wrong branch, and both maps are Record<> over a union of
 * exactly the strings the schema allows.
 */
function toLedgerRow(
  transaction: TransactionListItem,
  currency: string,
): LedgerRow {
  const base = {
    id: transaction.id,
    amount: formatMoney(transaction.total_amount, currency),
    date: formatDateOnly(transaction.trade_date),
    notes: transaction.notes,
  };

  if (isCashTransaction(transaction)) {
    const type = transaction.transaction_type as CashType;
    return {
      ...base,
      typeLabel: CASH_TYPE_LABELS[type] ?? transaction.transaction_type,
      tone: type === 'DEPOSIT' ? 'cash-in' : 'cash-out',
      symbol: '',
      detail: '-',
    };
  }

  const type = transaction.transaction_type as TradeType;
  return {
    ...base,
    typeLabel: TRADE_TYPE_LABELS[type] ?? transaction.transaction_type,
    tone: type === 'BUY' ? 'buy' : 'sell',
    symbol: transaction.assetSymbol ?? '-',
    detail:
      transaction.quantity === null
        ? '-'
        : `${formatQuantity(transaction.quantity)} หน่วย`,
  };
}

const TONE_CLASSES: Record<LedgerRow['tone'], string> = {
  buy: 'text-brand-300 bg-brand-500/15',
  sell: 'text-amber-300 bg-amber-500/15',
  'cash-in': 'text-emerald-300 bg-emerald-500/15',
  'cash-out': 'text-slate-300 bg-surface-border',
};

function RowIcon({ tone }: { tone: LedgerRow['tone'] }) {
  const className = 'h-4 w-4';

  if (tone === 'buy') {
    return <ArrowDownLeft aria-hidden="true" className={className} />;
  }
  if (tone === 'sell') {
    return <ArrowUpRight aria-hidden="true" className={className} />;
  }
  return <Wallet aria-hidden="true" className={className} />;
}

export function ActivityFeed({
  transactions,
  currency,
  emptyHint,
}: ActivityFeedProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-surface-border bg-surface-raised p-6 text-center">
        <p className="text-sm text-slate-400">ยังไม่มีรายการเคลื่อนไหว</p>
        <p className="mt-1 text-xs text-slate-500">{emptyHint}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {transactions.map((transaction) => {
        const row = toLedgerRow(transaction, currency);

        return (
          <li
            key={row.id}
            className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-raised px-4 py-3"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[row.tone]}`}
            >
              <RowIcon tone={row.tone} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium text-slate-100">{row.typeLabel}</span>
                {row.symbol !== '' ? (
                  <span className="text-slate-300">{row.symbol}</span>
                ) : null}
                <span className="text-xs text-slate-500">{row.date}</span>
              </p>

              <p className="mt-0.5 text-xs text-slate-400">
                {row.detail}
                {transaction.fees > 0
                  ? ` · ค่าธรรมเนียม ${formatMoney(transaction.fees, currency)}`
                  : ''}
              </p>

              {row.notes ? (
                <p className="mt-1 truncate text-xs italic text-slate-500">
                  {row.notes}
                </p>
              ) : null}
            </div>

            <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-100">
              {row.amount}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
