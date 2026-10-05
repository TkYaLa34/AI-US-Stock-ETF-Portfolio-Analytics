'use client';

/**
 * Interactive half of the dashboard.
 *
 * The page (src/app/dashboard/page.tsx) is a Server Component: it reads the
 * session, runs the RLS-scoped queries and computes the summary in
 * src/lib/portfolio/analytics.ts. Everything that needs `useState` lives here
 * instead, so the data is fetched once on the server and only the dialog
 * bookkeeping ships to the browser.
 *
 * ROUTE PROTECTION IS NOT THIS FILE'S JOB. src/middleware.ts redirects anonymous
 * visitors before the page renders at all, and the page repeats the check before
 * querying. This component may assume it is rendering for a signed-in user.
 *
 * DIALOG STATE IS A DISCRIMINATED UNION, not a pile of booleans. Four independent
 * `isXOpen` flags can produce a state where two dialogs are open at once, which
 * <dialog>.showModal() does not allow. One `kind` makes that unrepresentable.
 *
 * Every dialog is mounted with a `key` derived from what it edits. That is what
 * resets `useActionState` between openings - see the note in use-modal-action.ts
 * about a stale "success" closing a freshly reopened modal instantly.
 */

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  LogOut,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { DASHBOARD_PATH, PORTFOLIO_QUERY_PARAM } from '@/lib/portfolio/constants';
import type {
  AllocationSlice,
  PortfolioSummary,
  PositionView,
} from '@/lib/portfolio/analytics';
import type {
  AssetListItem,
  PortfolioListItem,
  TransactionListItem,
} from '@/lib/portfolio/types';
import { deleteAssetAction } from '@/server/actions/asset-actions';
import {
  deletePortfolioAction,
  setDefaultPortfolioAction,
} from '@/server/actions/portfolio-actions';

import { ActivityFeed } from './activity-feed';
import { AllocationList } from './allocation-list';
import { AssetFormModal } from './asset-form-modal';
import { ConfirmDialog } from './confirm-dialog';
import { PortfolioFormModal } from './portfolio-form-modal';
import { PositionsTable } from './positions-table';
import { SummaryCards } from './summary-cards';
import { TransactionFormModal } from './transaction-form-modal';

export type OpenDialog =
  | { kind: 'none' }
  | { kind: 'portfolio-form'; portfolioId: string | null }
  | { kind: 'asset-form'; assetId: string | null }
  | { kind: 'transaction' }
  | { kind: 'set-default'; portfolioId: string }
  | { kind: 'delete-portfolio'; portfolioId: string }
  | { kind: 'delete-asset'; assetId: string };

export interface DashboardShellProps {
  userLabel: string;
  portfolios: readonly PortfolioListItem[];
  selectedPortfolio: PortfolioListItem | null;
  positions: readonly PositionView[];
  /** null when there is no portfolio to summarise. */
  summary: PortfolioSummary | null;
  transactions: readonly TransactionListItem[];
  /** Every asset across every portfolio, for the transaction form's picker. */
  allAssets: readonly AssetListItem[];
  typeAllocation: readonly AllocationSlice[];
  sectorAllocation: readonly AllocationSlice[];
  /** Already localised and safe to render; null when the reads succeeded. */
  readError: string | null;
  /**
   * The raw Supabase SQLSTATE behind `readError`, or null when SHOW_ERROR_DETAILS
   * hides it. Computed on the server - see src/lib/portfolio/diagnostics.ts.
   */
  readErrorDetail: string | null;
}

export function DashboardShell({
  userLabel,
  portfolios,
  selectedPortfolio,
  positions,
  summary,
  transactions,
  allAssets,
  typeAllocation,
  sectorAllocation,
  readError,
  readErrorDetail,
}: DashboardShellProps) {
  const [dialog, setDialog] = useState<OpenDialog>({ kind: 'none' });
  const close = () => setDialog({ kind: 'none' });

  const currency = selectedPortfolio?.base_currency ?? 'USD';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:py-10">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-100 sm:text-2xl">
              แดชบอร์ดพอร์ตโฟลิโอ
            </h1>
            <p className="mt-1 truncate text-sm text-slate-400">
              เข้าสู่ระบบในชื่อ {userLabel}
            </p>
          </div>

          <form action="/auth/signout" method="post" className="shrink-0">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-3.5 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-brand-500"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              ออกจากระบบ
            </button>
          </form>
        </div>

        <PortfolioSwitcher
          portfolios={portfolios}
          selectedId={selectedPortfolio?.id ?? null}
          onCreate={() => setDialog({ kind: 'portfolio-form', portfolioId: null })}
          onEdit={(id) => setDialog({ kind: 'portfolio-form', portfolioId: id })}
          onDelete={(id) => setDialog({ kind: 'delete-portfolio', portfolioId: id })}
          onSetDefault={(id) => setDialog({ kind: 'set-default', portfolioId: id })}
        />
      </header>

      {readError ? (
        <Alert tone="error" message={readError} detail={readErrorDetail} />
      ) : null}

      {summary ? <SummaryCards summary={summary} /> : null}

      {selectedPortfolio === null ? (
        <EmptyState
          hasPortfolios={portfolios.length > 0}
          onCreatePortfolio={() =>
            setDialog({ kind: 'portfolio-form', portfolioId: null })
          }
        />
      ) : (
        <>
          <Toolbar
            portfolioName={selectedPortfolio.name}
            onRecordTrade={() =>
              setDialog({ kind: 'transaction' })
            }
            onAddAsset={() => setDialog({ kind: 'asset-form', assetId: null })}
          />

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              หลักทรัพย์ที่ถือครอง ({positions.length})
            </h2>

            <PositionsTable
              positions={positions}
              currency={currency}
              onEdit={(assetId) =>
                setDialog({ kind: 'asset-form', assetId })
              }
              onDelete={(assetId) =>
                setDialog({ kind: 'delete-asset', assetId })
              }
            />
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AllocationList
              title="สัดส่วนตามประเภททรัพย์สิน"
              slices={typeAllocation}
              currency={currency}
            />
            <AllocationList
              title="สัดส่วนตามกลุ่มอุตสาหกรรม"
              slices={sectorAllocation}
              currency={currency}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              รายการเคลื่อนไหวล่าสุด
            </h2>

            <ActivityFeed
              transactions={transactions}
              currency={currency}
              emptyHint="เริ่มจากเพิ่มหลักทรัพย์และบันทึกรายการซื้อ/ขายในพอร์ตโฟลิโอของคุณ"
            />
          </section>
        </>
      )}

      <p className="mt-auto pt-6 text-xs text-slate-500">
        ผลวิเคราะห์ประมวลผลโดย AI ไม่ใช่คำแนะนำทางการเงิน (Not Financial
        Advice)
      </p>

      <DashboardDialogs
        dialog={dialog}
        onClose={close}
        portfolios={portfolios}
        selectedPortfolio={selectedPortfolio}
        allAssets={allAssets}
      />
    </main>
  );
}

interface PortfolioSwitcherProps {
  portfolios: readonly PortfolioListItem[];
  selectedId: string | null;
  onCreate: () => void;
  onEdit: (portfolioId: string) => void;
  onDelete: (portfolioId: string) => void;
  onSetDefault: (portfolioId: string) => void;
}

function PortfolioSwitcher({
  portfolios,
  selectedId,
  onCreate,
  onEdit,
  onDelete,
  onSetDefault,
}: PortfolioSwitcherProps) {
  if (portfolios.length === 0) {
    return (
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        สร้างพอร์ตโฟลิโอแรก
      </button>
    );
  }

  return (
    <nav aria-label="เลือกพอร์ตโฟลิโอ" className="flex flex-col gap-3">
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {portfolios.map((portfolio) => {
          const isSelected = portfolio.id === selectedId;

          return (
            <li key={portfolio.id} className="shrink-0">
              <Link
                href={`${DASHBOARD_PATH}?${PORTFOLIO_QUERY_PARAM}=${portfolio.id}`}
                scroll={false}
                aria-current={isSelected ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? 'border-brand-500 bg-brand-600/20 text-brand-200'
                    : 'border-surface-border bg-surface-raised text-slate-300 hover:border-slate-600'
                }`}
              >
                {portfolio.is_default ? (
                  <Star aria-label="ค่าเริ่มต้น" className="h-3.5 w-3.5 fill-current" />
                ) : null}
                {portfolio.name}
              </Link>
            </li>
          );
        })}

        <li className="shrink-0">
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-surface-border px-3.5 py-2 text-sm font-medium text-slate-400 transition-colors hover:border-brand-500 hover:text-brand-300"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            เพิ่มพอร์ตโฟลิโอ
          </button>
        </li>
      </ul>

      {selectedId !== null ? (
        <PortfolioActions
          onEdit={() => onEdit(selectedId)}
          onDelete={() => onDelete(selectedId)}
          onSetDefault={() => onSetDefault(selectedId)}
        />
      ) : null}
    </nav>
  );
}

interface PortfolioActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

function PortfolioActions({ onEdit, onDelete, onSetDefault }: PortfolioActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <ToolbarButton
        label="ตั้งเป็นค่าเริ่มต้น"
        onClick={onSetDefault}
        icon={<Star aria-hidden="true" className="h-3.5 w-3.5" />}
      />
      <ToolbarButton
        label="แก้ไขพอร์ตโฟลิโอ"
        onClick={onEdit}
        icon={<Pencil aria-hidden="true" className="h-3.5 w-3.5" />}
      />
      <ToolbarButton
        label="ลบพอร์ตโฟลิโอ"
        onClick={onDelete}
        icon={<Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
        danger
      />
    </div>
  );
}

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  danger?: boolean;
}

function ToolbarButton({
  label,
  onClick,
  icon,
  danger = false,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors ${
        danger
          ? 'hover:border-red-500/60 hover:text-red-300'
          : 'hover:border-brand-500 hover:text-brand-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

interface ToolbarProps {
  portfolioName: string;
  onRecordTrade: () => void;
  onAddAsset: () => void;
}

function Toolbar({
  portfolioName,
  onRecordTrade,
  onAddAsset,
}: ToolbarProps) {
  return (
    <section
      aria-label={`การจัดการพอร์ตโฟลิโอ ${portfolioName}`}
      className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-raised p-4"
    >
      <p className="text-sm font-semibold text-slate-200">{portfolioName}</p>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onRecordTrade}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <ArrowLeftRight aria-hidden="true" className="h-4 w-4" />
          บันทึกรายการซื้อ / ขาย
        </button>

        <button
          type="button"
          onClick={onAddAsset}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-brand-500"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          เพิ่มหลักทรัพย์
        </button>
      </div>
    </section>
  );
}

interface EmptyStateProps {
  hasPortfolios: boolean;
  onCreatePortfolio: () => void;
}

function EmptyState({
  hasPortfolios,
  onCreatePortfolio,
}: EmptyStateProps) {
  return (
    <section className="rounded-xl border border-dashed border-surface-border bg-surface-raised p-8 text-center">
      <h2 className="text-base font-semibold text-slate-100">
        {hasPortfolios ? 'เลือกพอร์ตโฟลิโอเพื่อเริ่ม' : 'ยังไม่มีพอร์ตโฟลิโอ'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
        {hasPortfolios
          ? 'เลือกพอร์ตโฟลิโอจากเมนูด้านบน แล้วเริ่มบันทึกรายการซื้อ/ขายได้เลย'
          : 'สร้างพอร์ตโฟลิโอแรกของคุณ แล้วคุณจะสามารถเพิ่มหลักทรัพย์และติดตามผลตอบแทนได้'}
      </p>

      {hasPortfolios ? null : (
        <button
          type="button"
          onClick={onCreatePortfolio}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          สร้างพอร์ตโฟลิโอ
        </button>
      )}
    </section>
  );
}

interface DashboardDialogsProps {
  dialog: OpenDialog;
  onClose: () => void;
  portfolios: readonly PortfolioListItem[];
  selectedPortfolio: PortfolioListItem | null;
  allAssets: readonly AssetListItem[];
}

function DashboardDialogs({
  dialog,
  onClose,
  portfolios,
  selectedPortfolio,
  allAssets,
}: DashboardDialogsProps) {
  const defaultPortfolioId = selectedPortfolio?.id ?? portfolios[0]?.id ?? '';

  switch (dialog.kind) {
    case 'portfolio-form': {
      const portfolio =
        dialog.portfolioId === null
          ? undefined
          : portfolios.find((item) => item.id === dialog.portfolioId);

      return (
        <PortfolioFormModal
          key={`portfolio-${dialog.portfolioId ?? 'new'}`}
          portfolio={portfolio}
          onClose={onClose}
        />
      );
    }

    case 'asset-form': {
      const asset =
        dialog.assetId === null
          ? undefined
          : allAssets.find((item) => item.id === dialog.assetId);

      return (
        <AssetFormModal
          key={`asset-${dialog.assetId ?? 'new'}`}
          portfolios={portfolios}
          defaultPortfolioId={defaultPortfolioId}
          asset={asset}
          onClose={onClose}
        />
      );
    }

    case 'transaction':
      return (
        <TransactionFormModal
          key="transaction"
          portfolios={portfolios}
          assets={allAssets}
          defaultPortfolioId={defaultPortfolioId}
          onClose={onClose}
        />
      );

    case 'set-default': {
      const portfolio = portfolios.find(
        (item) => item.id === dialog.portfolioId,
      );

      if (!portfolio) {
        return null;
      }

      return (
        <ConfirmDialog
          key={`set-default-${portfolio.id}`}
          title={`ตั้ง "${portfolio.name}" เป็นค่าเริ่มต้น?`}
          description="พอร์ตโฟลิโอนี้จะถูกเปิดเป็นพอร์ตแรกเมื่อคุณเข้าแดชบอร์ดโดยไม่ระบุพอร์ต และพอร์ตเดิมจะเลิกเป็นค่าเริ่มต้น"
          confirmLabel="ตั้งเป็นค่าเริ่มต้น"
          pendingLabel="กำลังบันทึก..."
          action={setDefaultPortfolioAction}
          fields={{ portfolioId: portfolio.id }}
          onClose={onClose}
        />
      );
    }

    case 'delete-portfolio': {
      const portfolio = portfolios.find(
        (item) => item.id === dialog.portfolioId,
      );

      if (!portfolio) {
        return null;
      }

      return (
        <ConfirmDialog
          key={`delete-portfolio-${portfolio.id}`}
          title={`ลบพอร์ตโฟลิโอ "${portfolio.name}"?`}
          description="การลบนี้จะลบหลักทรัพย์และรายการซื้อ/ขายทั้งหมดในพอร์ตโฟลิโอนี้อย่างถาวร และการกระทำนี้ย้อนกลับไม่ได้"
          confirmLabel="ลบพอร์ตโฟลิโอ"
          pendingLabel="กำลังลบ..."
          action={deletePortfolioAction}
          fields={{ portfolioId: portfolio.id }}
          onClose={onClose}
        />
      );
    }

    case 'delete-asset': {
      const asset = allAssets.find((item) => item.id === dialog.assetId);

      if (!asset) {
        return null;
      }

      return (
        <ConfirmDialog
          key={`delete-asset-${asset.id}`}
          title={`ลบหลักทรัพย์ ${asset.symbol}?`}
          description={`รายการซื้อ/ขายของ ${asset.name} ที่เกี่ยวข้องจะถูกลบไปด้วย`}
          confirmLabel="ลบหลักทรัพย์"
          pendingLabel="กำลังลบ..."
          action={deleteAssetAction}
          fields={{ assetId: asset.id }}
          onClose={onClose}
        />
      );
    }

    case 'none':
      return null;
  }
}
