import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { DEFAULT_AUTHENTICATED_PATH } from '@/lib/auth/types';
import { listPortfolios } from '@/lib/portfolio/queries';
import { createClient } from '@/lib/supabase/server';
import { StockIntelligenceWorkbench } from '@/components/features/portfolio/stock-intelligence-workbench';

export const dynamic = 'force-dynamic';

interface TickerPageProps {
  params: Promise<{
    symbol: string;
  }>;
}

export async function generateMetadata({ params }: TickerPageProps): Promise<Metadata> {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();
  return {
    title: `${upperSymbol} - US Stock & ETF Intelligence | AI Portfolio Analytics`,
    description: `บทวิเคราะห์เชิงลึกสถาบันสำหรับ ${upperSymbol} (247WallSt Style): กรอบราคาเป้าหมาย 12M/5Y, Consensus, และปัจจัยเสี่ยง`,
  };
}

export default async function TickerDetailPage({ params }: TickerPageProps) {
  const { symbol } = await params;
  const cleanSymbol = symbol.toUpperCase().trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(DEFAULT_AUTHENTICATED_PATH)}`);
  }

  const { data: portfolios } = await listPortfolios();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              US Stock & ETF Deep-Dive Workbench
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              หน้าบทวิเคราะห์รายหลักทรัพย์ <span className="font-bold text-brand-400">{cleanSymbol}</span>
            </p>
          </div>
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700"
          >
            ← กลับสู่แดชบอร์ด
          </a>
        </div>

        <StockIntelligenceWorkbench
          portfolios={portfolios}
          initialSymbol={cleanSymbol}
        />
      </main>
    </div>
  );
}
