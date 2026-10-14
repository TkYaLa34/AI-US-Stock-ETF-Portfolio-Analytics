'use client';

/**
 * Global Search & US Stock/ETF Intelligence Workbench (Inspired by 247WallSt style).
 *
 * Provides:
 * 1. Global Search & Autocomplete with recent searches.
 * 2. Institutional Asset Deep-Dive Card (Market Cap, P/E, Dividend Yield, 52-Wk Range).
 * 3. Price Scenarios & Projections (Conservative, Base, Optimistic 12M & 5Y target ranges).
 * 4. Analyst Sentiment Gauge & Consensus Ring.
 * 5. AI Executive Summary ("OUR TAKE") with Catalysts & Risks.
 * 6. One-Click "Add to Target Portfolio" direct database insertion.
 */

import { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  TrendingUp,
  Target,
  BarChart2,
  ShieldAlert,
  CheckCircle2,
  Plus,
  History,
  Loader2,
  Briefcase,
} from 'lucide-react';

import {
  searchUSMarketSymbolsAction,
  getAssetIntelligenceAction,
  type AssetIntelligenceData,
  type MarketSymbolResult,
} from '@/server/actions/symbol-search-actions';
import { createAssetAction } from '@/server/actions/asset-actions';
import { INITIAL_PORTFOLIO_ACTION_STATE } from '@/lib/portfolio/types';
import type { PortfolioListItem } from '@/lib/portfolio/types';

export interface StockIntelligenceWorkbenchProps {
  portfolios: readonly PortfolioListItem[];
  initialSymbol?: string;
  onAssetAdded?: () => void;
}

const RECENT_POPULAR_SEARCHES = ['MRVL', 'NVDA', 'JEPQ', 'EMXC', 'VOO', 'QQQ', 'AAPL', 'MSFT'];

export function StockIntelligenceWorkbench({
  portfolios,
  initialSymbol = 'MRVL',
  onAssetAdded,
}: StockIntelligenceWorkbenchProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<MarketSymbolResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [activeSymbol, setActiveSymbol] = useState<string>(initialSymbol);
  const [intelData, setIntelData] = useState<AssetIntelligenceData | null>(null);
  const [isLoadingIntel, setIsLoadingIntel] = useState<boolean>(true);

  // Add to Portfolio Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(
    portfolios[0]?.id ?? '',
  );
  const [quantity, setQuantity] = useState<number>(50);
  const [price, setPrice] = useState<number>(0);
  const [isSubmittingTrade, setIsSubmittingTrade] = useState<boolean>(false);
  const [addNotice, setAddNotice] = useState<string | null>(null);

  // Load intelligence data when activeSymbol changes
  useEffect(() => {
    let active = true;
    async function loadIntel() {
      setIsLoadingIntel(true);
      try {
        const data = await getAssetIntelligenceAction(activeSymbol);
        if (active) {
          setIntelData(data);
          setPrice(data.currentPrice);
          setIsLoadingIntel(false);
        }
      } catch (err) {
        console.error('Error loading asset intelligence:', err);
        if (active) setIsLoadingIntel(false);
      }
    }
    loadIntel();
    return () => {
      active = false;
    };
  }, [activeSymbol]);

  // Handle live autocomplete
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length === 0) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      const results = await searchUSMarketSymbolsAction(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectTicker = (sym: string) => {
    setActiveSymbol(sym);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAddToPortfolioSubmit = async () => {
    if (!selectedPortfolioId || !intelData) return;

    setIsSubmittingTrade(true);
    setAddNotice(null);

    const formData = new FormData();
    formData.append('portfolioId', selectedPortfolioId);
    formData.append('symbol', intelData.symbol);
    formData.append('name', intelData.name);
    formData.append('assetType', intelData.assetType);
    formData.append('currency', 'USD');
    formData.append('quantity', String(quantity));
    formData.append('averageCost', String(price));
    formData.append('currentPrice', String(intelData.currentPrice));
    formData.append('notes', 'เพิ่มโดยตรงจาก US Stock & ETF Intelligence Workbench');

    const res = await createAssetAction(INITIAL_PORTFOLIO_ACTION_STATE, formData);
    setIsSubmittingTrade(false);

    if (res.status === 'success') {
      setAddNotice(`เพิ่ม ${intelData.symbol} จำนวน ${quantity} หุ้น เข้าสู่พอร์ตเรียบร้อยแล้ว!`);
      setTimeout(() => {
        setIsAddModalOpen(false);
        setAddNotice(null);
        if (onAssetAdded) onAssetAdded();
      }, 1200);
    } else {
      setAddNotice(res.message || 'บันทึกสินทรัพย์ไม่สำเร็จ');
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 flex flex-col gap-6 shadow-xl">
      {/* 1. Global Search & Autocomplete Workbench Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            US Stock & ETF Intelligence Workbench
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ค้นหาหลักทรัพย์ วิเคราะห์กรอบราคา 12M/5Y และเพิ่มเข้าพอร์ตในคลิกเดียว (247WallSt Institutional Style)
          </p>
        </div>

        {/* Search Input Bar */}
        <div className="relative w-full md:w-96">
          <div className="relative flex items-center">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาหุ้น หรือ ETF (เช่น MRVL, NVDA, JEPQ)..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-8 text-xs text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {isSearching ? (
              <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-brand-400" />
            ) : null}
          </div>

          {/* Autocomplete Dropdown */}
          {searchResults.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2 shadow-2xl">
              {searchResults.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => handleSelectTicker(item.symbol)}
                  className="flex w-full items-center justify-between rounded-lg p-2 text-left text-xs hover:bg-slate-900 transition-colors"
                >
                  <div>
                    <span className="font-bold text-brand-300">{item.symbol}</span>
                    <span className="ml-2 text-slate-300">{item.name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-900 px-2 py-0.5 rounded">
                    {item.assetType}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Popular Quick-Select Tags */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="text-slate-400 flex items-center gap-1 font-semibold shrink-0">
          <History className="h-3.5 w-3.5" /> ยอดนิยม:
        </span>
        {RECENT_POPULAR_SEARCHES.map((sym) => (
          <button
            key={sym}
            type="button"
            onClick={() => handleSelectTicker(sym)}
            className={`rounded-lg px-2.5 py-1 font-semibold transition-colors shrink-0 ${
              activeSymbol === sym
                ? 'bg-brand-600 text-white border border-brand-400'
                : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            {sym}
          </button>
        ))}
      </div>

      {/* 2. Institutional Asset Deep-Dive Card */}
      {isLoadingIntel ? (
        <div className="flex items-center justify-center p-12 text-xs text-slate-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-brand-400" /> กำลังประมวลผลข้อมูลบทวิเคราะห์สถาบัน...
        </div>
      ) : intelData ? (
        <div className="space-y-6">
          {/* Header Card with Add to Target Portfolio Trigger */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-brand-500/20 border border-brand-500/30 p-3 text-brand-300 font-extrabold text-xl">
                {intelData.symbol}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{intelData.name}</h3>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 uppercase">
                    {intelData.assetType} • {intelData.exchange}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-3 text-xs">
                  <span className="text-2xl font-extrabold text-slate-100">
                    ${intelData.currentPrice.toFixed(2)}
                  </span>
                  <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                    <TrendingUp className="h-3.5 w-3.5 inline" /> +{intelData.analystRatings.upsidePercent}% Upside Target
                  </span>
                </div>
              </div>
            </div>

            {/* One-Click Add to Target Portfolio Button */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-500 transition-colors shadow-lg shrink-0"
            >
              <Plus className="h-4 w-4" />
              เพิ่มเข้าพอร์ตโฟลิโอ (One-Click Add)
            </button>
          </div>

          {/* Key Valuation & Market Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <span className="text-slate-400 block font-medium">Market Cap</span>
              <span className="text-sm font-bold text-white mt-1 block">{intelData.marketCap}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <span className="text-slate-400 block font-medium">P/E Ratio</span>
              <span className="text-sm font-bold text-white mt-1 block">{intelData.peRatio}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <span className="text-slate-400 block font-medium">Dividend Yield</span>
              <span className="text-sm font-bold text-emerald-400 mt-1 block">{intelData.dividendYield}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <span className="text-slate-400 block font-medium">Forward EPS</span>
              <span className="text-sm font-bold text-white mt-1 block">{intelData.forwardEps}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 col-span-2 md:col-span-1">
              <span className="text-slate-400 block font-medium">52-Wk Price Range</span>
              <span className="text-sm font-bold text-slate-200 mt-1 block">
                ${intelData.week52Low.toFixed(2)} - ${intelData.week52High.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Target Price Scenarios & Projections (Conservative, Base, Optimistic) */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-emerald-400" />
                กรอบราคาเป้าหมาย & ประมาณการผลตอบแทน (Target Price Scenarios)
              </h4>
              <span className="text-xs text-slate-400">ประมวลผลจากประมาณการนักวิเคราะห์สถาบัน</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* 12-Month Target Scenario */}
              <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between font-bold text-slate-200 text-sm">
                  <span>กรอบราคาเป้าหมาย 12 เดือน (12-Month Target)</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-slate-950 p-2 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Conservative</span>
                    <span className="font-bold text-amber-400 mt-0.5 block">
                      ${intelData.projections.conservative12M.toFixed(2)}
                    </span>
                  </div>
                  <div className="rounded bg-brand-950/60 p-2 border border-brand-500/30">
                    <span className="text-brand-300 block text-[11px] font-bold">Base Case</span>
                    <span className="font-extrabold text-white mt-0.5 block">
                      ${intelData.projections.base12M.toFixed(2)}
                    </span>
                  </div>
                  <div className="rounded bg-slate-950 p-2 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Optimistic</span>
                    <span className="font-bold text-emerald-400 mt-0.5 block">
                      ${intelData.projections.optimistic12M.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5-Year Long-term Horizon */}
              <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between font-bold text-slate-200 text-sm">
                  <span>ประมาณการเติบโตระยะยาว 5 ปี (5-Year Target Outlook)</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-slate-950 p-2 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Conservative</span>
                    <span className="font-bold text-amber-400 mt-0.5 block">
                      ${intelData.projections.conservative5Y.toFixed(2)}
                    </span>
                  </div>
                  <div className="rounded bg-brand-950/60 p-2 border border-brand-500/30">
                    <span className="text-brand-300 block text-[11px] font-bold">Base Case</span>
                    <span className="font-extrabold text-white mt-0.5 block">
                      ${intelData.projections.base5Y.toFixed(2)}
                    </span>
                  </div>
                  <div className="rounded bg-slate-950 p-2 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Optimistic</span>
                    <span className="font-bold text-emerald-400 mt-0.5 block">
                      ${intelData.projections.optimistic5Y.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Analyst Consensus Gauge & AI Executive Summary ("OUR TAKE") */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            {/* Analyst Consensus Ring Gauge */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
                  <BarChart2 className="h-4 w-4 text-emerald-400" /> Analyst Rating Ring
                </h4>
                <span className="text-slate-400 text-[11px]">
                  {intelData.analystRatings.totalAnalysts} นักวิเคราะห์
                </span>
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="font-bold text-emerald-400 text-sm">
                    {intelData.analystRatings.consensus}
                  </span>
                  <span className="text-slate-300 font-bold">
                    Target: ${intelData.analystRatings.meanTargetPrice.toFixed(2)}
                  </span>
                </div>

                {/* Consensus Ratio Bar */}
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{ width: `${intelData.analystRatings.buyPercent}%` }}
                    title={`Buy ${intelData.analystRatings.buyPercent}%`}
                  />
                  <div
                    className="bg-amber-500 h-full"
                    style={{ width: `${intelData.analystRatings.holdPercent}%` }}
                    title={`Hold ${intelData.analystRatings.holdPercent}%`}
                  />
                  <div
                    className="bg-red-500 h-full"
                    style={{ width: `${intelData.analystRatings.sellPercent}%` }}
                    title={`Sell ${intelData.analystRatings.sellPercent}%`}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 mt-1.5">
                  <span>{intelData.analystRatings.buyPercent}% Buy</span>
                  <span>{intelData.analystRatings.holdPercent}% Hold</span>
                  <span>{intelData.analystRatings.sellPercent}% Sell</span>
                </div>
              </div>

              <div className="rounded bg-slate-900 p-2.5 border border-slate-800 text-[11px] text-slate-300">
                สัดส่วนคำแนะนำเชิงบวกคงระดับสูง สอดคล้องกับงบประมาณลงทุนในอุตสาหกรรม
              </div>
            </div>

            {/* AI Executive Summary ("OUR TAKE") & Catalysts */}
            <div className="md:col-span-2 rounded-xl border border-brand-500/30 bg-gradient-to-br from-brand-950/40 via-slate-950 to-slate-950 p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <span className="rounded bg-brand-500/20 text-brand-300 font-extrabold text-xs px-2.5 py-0.5 border border-brand-500/30">
                    OUR TAKE
                  </span>
                  <span className="text-xs text-slate-400 font-medium">บทวิเคราะห์ AI ประจำสัปดาห์</span>
                </div>

                <p className="mt-2 text-xs text-slate-200 font-semibold leading-relaxed">
                  {intelData.ourTake.summary}
                </p>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Growth Catalysts */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> ปัจจัยหนุนหลัก (Growth Catalysts):
                    </span>
                    <ul className="space-y-1 text-slate-300 text-[11px] list-disc list-inside">
                      {intelData.ourTake.catalysts.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Risk Factors */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-amber-400 flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5" /> ปัจจัยความเสี่ยง (Risk Factors):
                    </span>
                    <ul className="space-y-1 text-slate-300 text-[11px] list-disc list-inside">
                      {intelData.ourTake.riskFactors.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>คำแนะนำสัดส่วน: <strong className="text-slate-200">{intelData.ourTake.recommendedAllocationWeight}</strong></span>
                <span className="text-slate-500">Not Financial Advice</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 3. One-Click Add to Target Portfolio Modal */}
      {isAddModalOpen && intelData ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-brand-400" />
                เพิ่ม {intelData.symbol} เข้าสู่พอร์ตโฟลิโอ
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">เลือกพอร์ตโฟลิโอปลายทาง (Target Portfolio)</label>
                <select
                  value={selectedPortfolioId}
                  onChange={(e) => setSelectedPortfolioId(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-100 font-semibold focus:border-brand-500 focus:outline-none"
                >
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      พอร์ต: {p.name} ({p.base_currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">จำนวนหุ้น (Shares)</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-slate-100 font-semibold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">ราคาต้นทุนต่อหุ้น ($)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-slate-100 font-semibold"
                  />
                </div>
              </div>

              <div className="rounded bg-slate-950 p-3 border border-slate-800 text-slate-300">
                <span className="text-slate-400 block">มูลค่าการถือครองประเมิน:</span>
                <span className="text-base font-bold text-emerald-400 mt-0.5 block">
                  ${(quantity * price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {addNotice ? (
                <div className="rounded bg-brand-950/50 border border-brand-500/30 p-2.5 text-brand-300 font-semibold text-center">
                  {addNotice}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleAddToPortfolioSubmit}
                disabled={isSubmittingTrade}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {isSubmittingTrade ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    ยืนยันเพิ่มเข้าพอร์ต
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
