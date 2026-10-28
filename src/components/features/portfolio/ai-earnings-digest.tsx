'use client';

/**
 * AI Earnings Digest & Executive Sentiment Gauge Component.
 *
 * Designed with a Bloomberg / TradingView-inspired high-contrast dark slate theme:
 * 1. AI Sentiment Gauge: Confidence score bar/meter (e.g. "85% - Highly Bullish").
 * 2. Metric Highlights: Key Earnings Metrics (Revenue Beat %, EPS Surprise %, Next Q Guidance, Gross Margin Trend).
 * 3. Structured Guidance Digest: Clear side-by-side Bullish Points (emerald accents) vs Bearish/Risk Factors (red/rose accents).
 */

import { Flame, TrendingUp, AlertTriangle, CheckCircle, BarChart3, Zap } from 'lucide-react';
import type { EarningsDigestData } from '@/server/actions/symbol-search-actions';

export interface AiEarningsDigestProps {
  symbol: string;
  digest?: EarningsDigestData;
}

export function AiEarningsDigest({ symbol, digest }: AiEarningsDigestProps) {
  if (!digest) return null;

  const { sentimentScore, sentimentLabel, metrics, takeaways } = digest;

  // Determine sentiment badge color styles
  const getBadgeStyle = (label: string) => {
    switch (label) {
      case 'Highly Bullish':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Bullish':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      case 'Neutral':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
  };

  // Determine progress bar color gradient
  const getMeterGradient = (score: number) => {
    if (score >= 85) return 'from-teal-500 via-emerald-400 to-emerald-300';
    if (score >= 75) return 'from-teal-600 to-emerald-400';
    if (score >= 60) return 'from-amber-500 to-teal-500';
    return 'from-rose-600 to-amber-500';
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 md:p-6 shadow-2xl space-y-6">
      {/* Header: AI Earnings Digest Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-brand-600/30 to-emerald-600/20 border border-brand-500/30 p-2.5 text-emerald-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white tracking-wide">
                AI Earnings Digest & Call Transcripts Summary
              </h3>
              <span className="rounded-full bg-brand-500/10 border border-brand-500/30 px-2.5 py-0.5 text-[10px] font-bold text-brand-300 uppercase">
                {symbol} • Q3 Analysis
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              การวิเคราะห์เชิงลึกจาก Earnings Call Transcript และบทสรุปผู้บริหารโดย AI
            </p>
          </div>
        </div>

        {/* Sentiment Label Badge */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs font-semibold">Executive Sentiment:</span>
          <span
            className={`rounded-lg border px-3 py-1 text-xs font-extrabold flex items-center gap-1.5 shadow-sm ${getBadgeStyle(
              sentimentLabel,
            )}`}
          >
            <Flame className="h-3.5 w-3.5" />
            {sentimentScore}% — {sentimentLabel}
          </span>
        </div>
      </div>

      {/* 1. Executive Confidence Gauge (Meter Bar) */}
      <div className="space-y-2 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-slate-300 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            คะแนนความเชื่อมั่นผู้บริหาร (Executive Confidence Score Meter)
          </span>
          <span className="text-emerald-400 font-extrabold">{sentimentScore} / 100</span>
        </div>

        {/* Progress Bar with Gradient */}
        <div className="w-full bg-slate-950 h-3 rounded-full p-0.5 border border-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${getMeterGradient(
              sentimentScore,
            )} transition-all duration-1000 shadow-md`}
            style={{ width: `${Math.min(Math.max(sentimentScore, 5), 100)}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px] font-semibold text-slate-500 pt-1">
          <span>0% Cautious</span>
          <span>50% Neutral</span>
          <span>75% Bullish</span>
          <span>100% Highly Bullish</span>
        </div>
      </div>

      {/* 2. Key Earnings Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
          <span className="text-slate-400 font-medium block text-[11px]">Revenue Beat / Miss</span>
          <span className="text-sm font-extrabold text-emerald-400 block">{metrics.revenueBeatPercent}</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
          <span className="text-slate-400 font-medium block text-[11px]">EPS Surprise %</span>
          <span className="text-sm font-extrabold text-emerald-400 block">{metrics.epsSurprisePercent}</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
          <span className="text-slate-400 font-medium block text-[11px]">Next Q Guidance</span>
          <span className="text-sm font-extrabold text-slate-100 block truncate">{metrics.nextQuarterGuidance}</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
          <span className="text-slate-400 font-medium block text-[11px]">Gross Margin Trend</span>
          <span className="text-sm font-extrabold text-teal-300 block">{metrics.grossMarginTrend}</span>
        </div>
      </div>

      {/* 3. Structured Guidance Digest: Bullish Points vs Bearish / Risk Factors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Bullish Takeaways Panel */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-2.5">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <h4 className="font-bold text-emerald-300 text-sm">
              ปัจจัยเชิงบวกหลัก (Bullish Takeaways)
            </h4>
          </div>
          <ul className="space-y-2 text-slate-200 text-xs">
            {takeaways.bullishPoints.map((point) => (
              <li key={point} className="flex items-start gap-2 leading-relaxed">
                <span className="text-emerald-400 font-bold shrink-0">✓</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bearish / Risk Factors Panel */}
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-rose-500/20 pb-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <h4 className="font-bold text-rose-300 text-sm">
              ปัจจัยความเสี่ยง / ข้อควรระวัง (Bearish & Risk Factors)
            </h4>
          </div>
          <ul className="space-y-2 text-slate-200 text-xs">
            {takeaways.bearishPoints.map((point) => (
              <li key={point} className="flex items-start gap-2 leading-relaxed">
                <span className="text-rose-400 font-bold shrink-0">⚠️</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
