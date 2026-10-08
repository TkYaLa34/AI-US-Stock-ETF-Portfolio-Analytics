'use client';

/**
 * Symbol Search Autocomplete component.
 *
 * Allows searching by ticker symbol (e.g. AAPL, VOO, QQQ) or full company/fund name
 * with type filters (All, Stocks, ETFs), debounced fetching, and asset type badges.
 */

import { useEffect, useRef, useState } from 'react';
import { Filter, Loader2, Search } from 'lucide-react';

import {
  searchUSMarketSymbolsAction,
  type MarketSymbolResult,
} from '@/server/actions/symbol-search-actions';

export interface SymbolSearchProps {
  onSelectSymbol: (symbol: MarketSymbolResult) => void;
  placeholder?: string;
  initialValue?: string;
}

type AssetFilter = 'all' | 'stock' | 'etf';

export function SymbolSearch({
  onSelectSymbol,
  placeholder = 'ค้นหาหุ้นหรือ ETF (เช่น AAPL, VOO, QQQ)...',
  initialValue = '',
}: SymbolSearchProps) {
  const [query, setQuery] = useState(initialValue);
  const [filter, setFilter] = useState<AssetFilter>('all');
  const [results, setResults] = useState<readonly MarketSymbolResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const fetched = await searchUSMarketSymbolsAction(trimmed);
        setResults(fetched);
        setIsOpen(true);
      } catch (err) {
        console.error('SymbolSearch error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredResults = results.filter((item) => {
    if (filter === 'stock') return item.assetType === 'stock';
    if (filter === 'etf') return item.assetType === 'etf';
    return true;
  });

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-9 pr-8 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-brand-400" />
        ) : null}
      </div>

      {isOpen && query.trim().length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900 p-2 shadow-xl">
          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-800 text-[11px]">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <Filter className="h-3 w-3" /> ตัวกรอง:
            </span>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded px-2 py-0.5 font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setFilter('stock')}
              className={`rounded px-2 py-0.5 font-medium transition-colors ${
                filter === 'stock'
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              หุ้น (Stocks)
            </button>
            <button
              type="button"
              onClick={() => setFilter('etf')}
              className={`rounded px-2 py-0.5 font-medium transition-colors ${
                filter === 'etf'
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              กองทุน (ETFs)
            </button>
          </div>

          {filteredResults.length === 0 && !isLoading ? (
            <div className="p-3 text-center text-xs text-slate-400">
              ไม่พบหลักทรัพย์ที่ตรงกับ &quot;{query}&quot;
            </div>
          ) : (
            filteredResults.map((item) => (
              <button
                key={`${item.symbol}-${item.exchange}`}
                type="button"
                onClick={() => {
                  setQuery(item.symbol);
                  onSelectSymbol(item);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md p-2 text-left text-xs transition-colors hover:bg-slate-800"
              >
                <div>
                  <span className="font-bold text-slate-100">{item.symbol}</span>
                  <span className="ml-2 text-slate-400">{item.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      item.assetType === 'etf'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {item.assetType}
                  </span>
                  <span className="text-slate-500">{item.exchange}</span>
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
