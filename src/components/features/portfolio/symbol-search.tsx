'use client';

/**
 * Symbol Search Autocomplete component.
 *
 * Allows searching by ticker symbol (e.g. AAPL, VOO, QQQ, MRVL) or full company/fund name
 * with type filters (All, Stocks, ETFs), debounced fetching, keyboard navigation (Up/Down/Enter),
 * and automatic routing to /portfolio/ticker/[symbol].
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Loader2, Search } from 'lucide-react';

import {
  searchUSMarketSymbolsAction,
  type MarketSymbolResult,
} from '@/server/actions/symbol-search-actions';

export interface SymbolSearchProps {
  onSelectSymbol?: (symbol: MarketSymbolResult) => void;
  placeholder?: string;
  initialValue?: string;
}

type AssetFilter = 'all' | 'stock' | 'etf';

export function SymbolSearch({
  onSelectSymbol,
  placeholder = 'ค้นหาชื่อย่อ เช่น AAPL, VOO, QQQ',
  initialValue = '',
}: SymbolSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialValue);
  const [filter, setFilter] = useState<AssetFilter>('all');
  const [results, setResults] = useState<readonly MarketSymbolResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        setResults([]);
        setIsLoading(false);
        setSelectedIndex(-1);
        return;
      }

      setIsLoading(true);
      try {
        const fetched = await searchUSMarketSymbolsAction(trimmed);
        setResults(fetched);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err) {
        console.error('SymbolSearch error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

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

  const handleChooseSymbol = (item: MarketSymbolResult) => {
    const formatted = item.symbol.toUpperCase();
    setQuery(formatted);
    setIsOpen(false);
    if (onSelectSymbol) {
      onSelectSymbol(item);
    }
    router.push(`/portfolio/ticker/${formatted}`);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredResults.length === 0) {
      if (e.key === 'Enter' && query.trim().length > 0) {
        const sym = query.trim().toUpperCase();
        setIsOpen(false);
        router.push(`/portfolio/ticker/${sym}`);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredResults.length) {
        const selected = filteredResults[selectedIndex];
        if (selected) {
          handleChooseSymbol(selected);
        }
      } else if (query.trim().length > 0) {
        const sym = query.trim().toUpperCase();
        setIsOpen(false);
        router.push(`/portfolio/ticker/${sym}`);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-emerald-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.toUpperCase());
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full rounded-xl border border-emerald-500/30 bg-slate-900/90 py-2.5 pl-10 pr-8 text-sm text-slate-100 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-md font-medium"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-emerald-400" />
        ) : null}
      </div>

      {isOpen && query.trim().length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2 shadow-2xl">
          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-800 text-[11px]">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <Filter className="h-3 w-3 text-emerald-400" /> ตัวกรอง:
            </span>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-md px-2.5 py-0.5 font-semibold transition-colors ${
                filter === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setFilter('stock')}
              className={`rounded-md px-2.5 py-0.5 font-semibold transition-colors ${
                filter === 'stock'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              หุ้น (Stocks)
            </button>
            <button
              type="button"
              onClick={() => setFilter('etf')}
              className={`rounded-md px-2.5 py-0.5 font-semibold transition-colors ${
                filter === 'etf'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              กองทุน (ETFs)
            </button>
          </div>

          {filteredResults.length === 0 && !isLoading ? (
            <div className="p-3 text-center text-xs text-slate-400">
              ไม่พบหลักทรัพย์ที่ตรงกับ &quot;{query}&quot; (กด Enter เพื่อเปิดวิเคราะห์ {query})
            </div>
          ) : (
            filteredResults.map((item, idx) => (
              <button
                key={`${item.symbol}-${item.exchange}`}
                type="button"
                onClick={() => handleChooseSymbol(item)}
                className={`flex w-full items-center justify-between rounded-lg p-2.5 text-left text-xs transition-colors ${
                  selectedIndex === idx ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div>
                  <span className="font-bold text-emerald-400 text-sm">{item.symbol}</span>
                  <span className="ml-2.5 text-slate-200">{item.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                      item.assetType === 'etf'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {item.assetType}
                  </span>
                  <span className="text-slate-500 text-[11px]">{item.exchange}</span>
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
