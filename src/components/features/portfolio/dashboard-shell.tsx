'use client';

/**
 * US Stock & ETF Portfolio Analytics Dashboard.
 *
 * Provides a clean vertical layout featuring:
 * 1. Top Navigation & US Market Search Bar
 * 2. Section 1: Portfolio Health & Summary Grid (Health Score, 4-Card Metrics, AI Rebalancing Insights)
 * 3. Section 2: AI Institutional Intel & Smart Money Feed ("Exec Sum" & "OUR TAKE")
 * 4. Section 3: Sequential Asset Deep-Dive View (At a Glance, Analyst Consensus & Targets, 5-Year Forecast Chart, Social Sentiment, Earnings)
 * 5. Section 4: Collapsible AI Advisor Drawer
 */

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity,
  BarChart3,
  ArrowLeftRight,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe,
  LineChart,
  LogOut,
  Pencil,
  Plus,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  TrendingDown,
  TrendingUp,
  Trash2,
  Zap,
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
import type { MarketSymbolResult } from '@/server/actions/symbol-search-actions';

import { ActivityFeed } from './activity-feed';
import { AllocationList } from './allocation-list';
import { AssetFormModal } from './asset-form-modal';
import { ConfirmDialog } from './confirm-dialog';
import { PortfolioFormModal } from './portfolio-form-modal';
import { PositionsTable } from './positions-table';
import { SummaryCards } from './summary-cards';
import { SymbolSearch } from './symbol-search';
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

const INSTITUTIONAL_INTEL = [
  {
    title: 'กองทุนระดับโลกปรับเพิ่มน้ำหนักลงทุนในกลุ่ม AI Infrastructure & Semiconductor',
    execSum: 'สถาบันการเงินและกองทุนขนาดใหญ่เข้าสะสมหุ้นกลุ่มเซมิคอนดักเตอร์และโครงสร้างพื้นฐาน AI ต่อเนื่องในสัปดาห์นี้',
    ourTake: 'OUR TAKE: หุ้นกลุ่มเทคโนโลยีหลักในพอร์ตโฟลิโอของคุณได้รับแรงหนุนเชิงบวกจากกระแสเงินทุนสถาบัน',
    type: 'Block Trade / Accumulation',
    time: '10 นาทีที่แล้ว',
  },
  {
    title: 'การหมุนเวียนกลุ่มอุตสาหกรรม (Sector Rotation) สู่ดัชนีหุ้นวงกว้าง',
    detail: 'พบแรงขายทำกำไรในหุ้นกลุ่มพลังงานระยะสั้นเพื่อเปลี่ยนเข้าสะสม ETF ดัชนีหลักอย่าง S&P 500 และ NASDAQ 100',
    ourTake: 'OUR TAKE: การกระจายความเสี่ยงสู่ ETF ดัชนีหลักช่วยลดความผันผวนของพอร์ตในช่วงผลประกอบการออก',
    type: 'Institutional Flow',
    time: '45 นาทีที่แล้ว',
const WATCHLIST_SAMPLE = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', price: '$581.50', change: '+0.41%', isUp: true, type: 'ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust Series 1', price: '$492.30', change: '+0.63%', isUp: true, type: 'ETF' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', price: '$533.80', change: '+0.42%', isUp: true, type: 'ETF' },
  { symbol: 'AAPL', name: 'Apple Inc.', price: '$231.30', change: '+1.25%', isUp: true, type: 'Stock' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: '$418.25', change: '-0.18%', isUp: false, type: 'Stock' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: '$134.80', change: '+2.14%', isUp: true, type: 'Stock' },
];

const INSTITUTIONAL_INTEL = [
  {
    title: 'สถาบันเพิ่มน้ำหนักลงทุนในกลุ่ม Semiconductor & AI Infrastructure',
    detail: 'กองทุนสถาบันรายใหญ่เพิ่มสถานะซื้อสะสม NVDA, AVGO และ QQQ อย่างต่อเนื่องในสัปดาห์นี้',
    type: 'Block Trade / Accumulation',
    time: '15 นาทีที่แล้ว',
  },
  {
    title: 'การลดความเสี่ยงสัดส่วนหมวดพลังงานก่อนรายงานผลประกอบการ',
    detail: 'มีการปรับลดสถานะขายทำกำไรในหุ้นกลุ่มพลังงานขนาดใหญ่ (XOM, CVX) เพื่อเก็งกำไรในดัชนี S&P 500',
    type: 'Sector Rotation',
    time: '1 ชั่วโมงที่แล้ว',
  },
  {
    title: 'การไหลเข้าของกระแสเงินทุนสถาบันใน Vanguard & SPDR Index ETFs',
    detail: 'ยอดสุทธิการซื้อสะสม VOO และ SPY พุ่งสูงขึ้น ชี้แจงมุมมองเชิงบวกต่อตลาดหุ้นสหรัฐฯ ในระยะกลาง',
    type: 'Institutional ETF Flow',
    time: '3 ชั่วโมงที่แล้ว',
  },
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
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(true);
  const [selectedDeepDiveSymbol, setSelectedDeepDiveSymbol] = useState<string>('NVDA');

  const close = () => setDialog({ kind: 'none' });
  const currency = selectedPortfolio?.base_currency ?? 'USD';

  const handleGlobalSelectSymbol = (item: MarketSymbolResult) => {
    setSelectedDeepDiveSymbol(item.symbol);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* 1. Real-time Market Ticker Header */}
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
            <span>InvestAI Analytics Terminal</span>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6">
        {/* Top Header & US Market Search Bar */}
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center gap-2">
                AI Portfolio Analytics & Insights
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                เข้าสู่ระบบในชื่อ <span className="font-medium text-slate-200">{userLabel}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Pillar 1: Global Market Search with Autocomplete */}
              <div className="flex-1 md:w-80">
                <SymbolSearch onSelectSymbol={handleGlobalSelectSymbol} />
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

        {/* Portfolio Summary Cards */}
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

            {/* Pillar 3: Active AI Portfolio Management Advisor Drawer */}
            {isAiDrawerOpen ? (
              <div className="rounded-xl border border-brand-500/40 bg-gradient-to-br from-brand-950/50 via-slate-900 to-slate-900 p-5 shadow-2xl transition-all">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-brand-400" />
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                      AI Portfolio Management Advisor
                      <span className="rounded bg-brand-500/20 text-brand-300 text-[10px] px-2 py-0.5 font-semibold uppercase">
                        Live Analytics
                      </span>
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAiDrawerOpen(false)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    ซ่อนที่ปรึกษา AI
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  {/* Health Score */}
                  <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">Portfolio Health Score</p>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-emerald-400">88</span>
                        <span className="text-sm font-semibold text-slate-400">/ 100</span>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 inline" /> สุขภาพพอร์ตดีเยี่ยม
                    </p>
                  </div>

                  {/* Risk Profile */}
                  <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">ระดับความเสี่ยง (Risk Metric)</p>
                      <p className="mt-2 text-lg font-bold text-amber-300 flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4" /> ปานกลาง-ค่อนข้างสูง
                      </p>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                      มีสัดส่วนหุ้นเติบโตสูง (Tech/AI Growth)
                    </p>
                  </div>

                  {/* Rebalance Recommendation */}
                  <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 md:col-span-2 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase text-brand-300 flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5" /> AI Actionable Rebalancing Recommendation
                      </p>
                      <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                        พอร์ตโฟลิโอของคุณมีการกระจายตัวในกลุ่ม Tech สูง แนะนำการส่งคำสั่งซื้อสะสมดัชนีวงกว้างเช่น <span className="font-bold text-white">VOO</span> หรือ <span className="font-bold text-white">SPY</span> เพิ่มเติมเพื่อสร้างสมดุลกระแสเงินสดและผลตอบแทน
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
                      <span>คำนวณจากสถานะถือครองล่าสุด ({positions.length} รายการ)</span>
                      <button
                        type="button"
                        onClick={() => setDialog({ kind: 'transaction' })}
                        className="font-semibold text-brand-400 hover:text-brand-300 underline"
                      >
                        ส่งคำสั่งรีบาลานซ์พอร์ต →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Pillar 2: AI Smart Money & Institutional News Intel */}
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-brand-400" />
                  <h3 className="font-bold text-slate-100">AI Smart Money & Institutional Intel</h3>
                </div>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-emerald-400" /> อัปเดตแบบเรียลไทม์
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {INSTITUTIONAL_INTEL.map((intel) => (
                  <div
                    key={intel.title}
                    className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-4 flex flex-col justify-between hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-brand-300">
                        <span>{intel.type}</span>
                        <span className="text-slate-500 font-normal">{intel.time}</span>
                      </div>
                      <h4 className="mt-2 font-semibold text-sm text-slate-100 leading-snug">
                        {intel.title}
                      </h4>
                      <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                        {intel.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Tabbed Dual View Content */}
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

            <PositionsTable
              positions={positions}
              currency={currency}
              onEdit={(assetId) => setDialog({ kind: 'asset-form', assetId })}
              onDelete={(assetId) => setDialog({ kind: 'delete-asset', assetId })}
            />

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 mt-2">
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

            <section className="flex flex-col gap-3 mt-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                ประวัติรายการเคลื่อนไหว (BUY / SELL)
              </h3>
              <ActivityFeed
                transactions={transactions}
                currency={currency}
                emptyHint="เริ่มบันทึกรายการเพื่อสร้างประวัติการลงทุน"
              />
            </section>
          </div>
        </section>

        {/* SECTION 4: Collapsible AI Advisor Drawer */}
        {isAiDrawerOpen ? (
          <aside className="rounded-xl border border-brand-500/30 bg-slate-900 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-brand-400" />
                <h3 className="font-bold text-slate-100">Section 4: Active AI Portfolio Advisor Panel</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAiDrawerOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                ปิดที่ปรึกษา AI
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5">
                <p className="font-bold text-slate-200">สัดส่วนการลงทุนกระจายตัวสอดคล้องกับดัชนี</p>
                <p className="mt-1 text-slate-400 leading-relaxed">
                  สินทรัพย์ส่วนใหญ่เน้นหุ้นกลุ่มเติบโต แนะนำรักษาวินัยการลงทุนระยะยาว
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5">
                <p className="font-bold text-slate-200">ไม่มีภาระความเสี่ยงจากเลเวอเรจ</p>
                <p className="mt-1 text-slate-400 leading-relaxed">
                  พอร์ตการลงทุนเป็นรูปแบบถือครองจริง ไม่มีสัญญาอนุพันธ์ที่มีความเสี่ยงสูง
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5">
                <p className="font-bold text-slate-200">คำเตือนข้อตกลง AI</p>
                <p className="mt-1 text-slate-400 leading-relaxed">
                  ผลวิเคราะห์ประมวลผลโดย AI ไม่ใช่คำแนะนำทางการเงิน (Not Financial Advice)
                </p>
              </div>
            </div>
          </aside>
        ) : null}

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
