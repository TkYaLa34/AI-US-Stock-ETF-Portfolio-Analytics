'use client';

/**
 * Interactive half of the dashboard with InvestAI Navigator theme.
 *
 * Features:
 * - Market Ticker Header (S&P 500, NASDAQ, VIX)
 * - Symbol Search Input
 * - Tabbed Dual View ("My Holdings" vs "Watchlist")
 * - Collapsible AI Insights Drawer
 * - Trade-only execution (BUY / SELL)
 */

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Globe,
  LogOut,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
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

export type DashboardTab = 'holdings' | 'watchlist';

export interface DashboardShellProps {
  userLabel: string;
  portfolios: readonly PortfolioListItem[];
  selectedPortfolio: PortfolioListItem | null;
  positions: readonly PositionView[];
  summary: PortfolioSummary | null;
  transactions: readonly TransactionListItem[];
  allAssets: readonly AssetListItem[];
  typeAllocation: readonly AllocationSlice[];
  sectorAllocation: readonly AllocationSlice[];
  readError: string | null;
  readErrorDetail: string | null;
}

const MARKET_TICKERS = [
  { symbol: 'S&P 500', value: '5,815.03', change: '+0.41%', isUp: true },
  { symbol: 'NASDAQ', value: '18,367.10', change: '+0.63%', isUp: true },
  { symbol: 'VIX', value: '14.85', change: '-2.11%', isUp: false },
  { symbol: 'US 10Y', value: '4.08%', change: '+0.03%', isUp: true },
];

const WATCHLIST_SAMPLE = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', price: '$581.50', change: '+0.41%', isUp: true, type: 'ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: '$492.30', change: '+0.63%', isUp: true, type: 'ETF' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', price: '$533.80', change: '+0.42%', isUp: true, type: 'ETF' },
  { symbol: 'AAPL', name: 'Apple Inc.', price: '$231.30', change: '+1.25%', isUp: true, type: 'Stock' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: '$418.25', change: '-0.18%', isUp: false, type: 'Stock' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: '$134.80', change: '+2.14%', isUp: true, type: 'Stock' },
];

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
  const [activeTab, setActiveTab] = useState<DashboardTab>('holdings');
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const close = () => setDialog({ kind: 'none' });
  const currency = selectedPortfolio?.base_currency ?? 'USD';

  const filteredWatchlist = WATCHLIST_SAMPLE.filter(
    (item) =>
      item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* 1. Market Ticker Header Bar */}
      <div className="border-b border-slate-800 bg-slate-900/90 text-xs text-slate-300 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5">
          <div className="flex items-center gap-4 overflow-x-auto py-0.5 no-scrollbar">
            <span className="flex items-center gap-1.5 font-semibold text-brand-400 shrink-0">
              <Globe className="h-3.5 w-3.5" /> US Markets:
            </span>
            {MARKET_TICKERS.map((ticker) => (
              <div key={ticker.symbol} className="flex items-center gap-1.5 shrink-0 text-slate-300">
                <span className="font-medium text-slate-200">{ticker.symbol}</span>
                <span className="tabular-nums">{ticker.value}</span>
                <span
                  className={`flex items-center text-[11px] font-semibold tabular-nums ${
                    ticker.isUp ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {ticker.isUp ? (
                    <TrendingUp className="mr-0.5 h-3 w-3 inline" />
                  ) : (
                    <TrendingDown className="mr-0.5 h-3 w-3 inline" />
                  )}
                  {ticker.change}
                </span>
              </div>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3 shrink-0 text-slate-400">
            <span>InvestAI Navigator</span>
            <span className="text-slate-700">•</span>
            <span>Real-time Trade Terminal</span>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
        {/* Top Header & Search Bar */}
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center gap-2">
                InvestAI Navigator
                <span className="rounded bg-brand-500/20 text-brand-300 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider border border-brand-500/30">
                  Trade Only
                </span>
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                เข้าสู่ระบบในชื่อ <span className="font-medium text-slate-200">{userLabel}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Symbol Search Bar */}
              <div className="relative flex-1 md:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาหุ้น/ETF เช่น AAPL, VOO, QQQ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <form action="/auth/signout" method="post" className="shrink-0">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  ออกจากระบบ
                </button>
              </form>
            </div>
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

        {/* 2. Portfolio Summary Cards (4-card grid) */}
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
            {/* Toolbar Action Bar */}
            <Toolbar
              portfolioName={selectedPortfolio.name}
              onRecordTrade={() => setDialog({ kind: 'transaction' })}
              onAddAsset={() => setDialog({ kind: 'asset-form', assetId: null })}
              onToggleAiDrawer={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
              isAiDrawerOpen={isAiDrawerOpen}
            />

            {/* Collapsible AI Insights Drawer */}
            {isAiDrawerOpen ? (
              <div className="rounded-xl border border-brand-500/30 bg-gradient-to-r from-brand-950/40 via-slate-900 to-slate-900 p-5 transition-all">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-brand-400 animate-pulse" />
                    <h3 className="font-semibold text-slate-100">InvestAI Insights & Portfolio Risk Analysis</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAiDrawerOpen(false)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    ปิดแถบ AI
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-300">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3.5">
                    <p className="font-semibold text-slate-200">การกระจายความเสี่ยง</p>
                    <p className="mt-1 text-xs text-slate-400">
                      พอร์ตโฟลิโอมีการกระจายตัวในกลุ่มอุตสาหกรรมเทคโนโลยีและดัชนีหลักอย่างเหมาะสม
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3.5">
                    <p className="font-semibold text-slate-200">คำแนะนำการเทรด</p>
                    <p className="mt-1 text-xs text-slate-400">
                      พิจารณาทยอยสะสมหุ้นกลุ่มคุณค่า หรือ ETF ดัชนีหลักเพื่อลดความผันผวนของพอร์ต
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3.5">
                    <p className="font-semibold text-slate-200">ข้อควรระวัง</p>
                    <p className="mt-1 text-xs text-slate-400">
                      ผลวิเคราะห์ประมวลผลโดย AI ไม่ใช่คำแนะนำทางการเงิน (Not Financial Advice)
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* 3. Tabbed Dual View Content */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('holdings')}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'holdings'
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  รายการถือครอง ({positions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('watchlist')}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'watchlist'
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  Watchlist ตลาดสหรัฐฯ
                </button>
              </div>
            </div>

            {activeTab === 'holdings' ? (
              <>
                <section className="flex flex-col gap-3">
                  <PositionsTable
                    positions={positions}
                    currency={currency}
                    onEdit={(assetId) => setDialog({ kind: 'asset-form', assetId })}
                    onDelete={(assetId) => setDialog({ kind: 'delete-asset', assetId })}
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
                    รายการเทรดล่าสุด (BUY / SELL)
                  </h2>

                  <ActivityFeed
                    transactions={transactions}
                    currency={currency}
                    emptyHint="เริ่มจากเพิ่มหลักทรัพย์และบันทึกรายการซื้อ/ขายในพอร์ตโฟลิโอของคุณ"
                  />
                </section>
              </>
            ) : (
              /* Watchlist Section */
              <section className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-200">US Stocks & ETFs Watchlist</h3>
                  <span className="text-xs text-slate-400">ราคาตลาดโดยประมาณ</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 bg-slate-950/50">
                      <tr>
                        <th className="px-4 py-3">สัญลักษณ์</th>
                        <th className="px-4 py-3">ชื่อหลักทรัพย์</th>
                        <th className="px-4 py-3">ประเภท</th>
                        <th className="px-4 py-3 text-right">ราคา</th>
                        <th className="px-4 py-3 text-right">เปลี่ยนแปลง (24 ชม.)</th>
                        <th className="px-4 py-3 text-right">แอ็กชัน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredWatchlist.map((item) => (
                        <tr key={item.symbol} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-semibold text-slate-100">{item.symbol}</td>
                          <td className="px-4 py-3 text-slate-300 text-xs">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            <span className="rounded bg-slate-800 px-2 py-0.5">{item.type}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-200">
                            {item.price}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold tabular-nums text-xs ${
                              item.isUp ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {item.change}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setDialog({ kind: 'transaction' })}
                              className="rounded border border-brand-500/40 bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-300 hover:bg-brand-500 hover:text-white transition-colors"
                            >
                              ส่งคำสั่งเทรด
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        <footer className="mt-auto pt-6 text-center text-xs text-slate-500">
          ผลวิเคราะห์ประมวลผลโดย AI ไม่ใช่คำแนะนำทางการเงิน (Not Financial Advice)
        </footer>

        <DashboardDialogs
          dialog={dialog}
          onClose={close}
          portfolios={portfolios}
          selectedPortfolio={selectedPortfolio}
          allAssets={allAssets}
        />
      </main>
    </div>
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
      <ul className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
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
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                }`}
              >
                {portfolio.is_default ? (
                  <Star aria-label="ค่าเริ่มต้น" className="h-3.5 w-3.5 fill-current text-amber-400" />
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-800 px-3.5 py-2 text-sm font-medium text-slate-400 transition-colors hover:border-brand-500 hover:text-brand-300"
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
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors ${
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
  onToggleAiDrawer: () => void;
  isAiDrawerOpen: boolean;
}

function Toolbar({
  portfolioName,
  onRecordTrade,
  onAddAsset,
  onToggleAiDrawer,
  isAiDrawerOpen,
}: ToolbarProps) {
  return (
    <section
      aria-label={`การจัดการพอร์ตโฟลิโอ ${portfolioName}`}
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-200">{portfolioName}</p>
        <button
          type="button"
          onClick={onToggleAiDrawer}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-300 hover:bg-brand-500/20 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {isAiDrawerOpen ? 'ซ่อนวิเคราะห์ AI' : 'ดูวิเคราะห์ AI'}
          {isAiDrawerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onRecordTrade}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <ArrowLeftRight aria-hidden="true" className="h-4 w-4" />
          บันทึกรายการซื้อ / ขาย (BUY & SELL)
        </button>

        <button
          type="button"
          onClick={onAddAsset}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-700"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          เพิ่มหลักทรัพย์ใหม่
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
    <section className="rounded-xl border border-dashed border-slate-800 bg-slate-900 p-8 text-center">
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
