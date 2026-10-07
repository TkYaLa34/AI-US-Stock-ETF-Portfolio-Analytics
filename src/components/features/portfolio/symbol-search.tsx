'use client';

/**
 * Symbol Search Autocomplete component.
 *
 * Allows searching by ticker symbol (e.g. AAPL, VOO, QQQ) or full company/fund name
 * with debounced server action fetching, loading indicator, and keyboard/click navigation.
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import {
  searchUSMarketSymbolsAction,
  type MarketSymbolResult,
} from '@/server/actions/symbol-search-actions';

export interface SymbolSearchProps {
  onSelectSymbol: (symbol: MarketSymbolResult) => void;
  placeholder?: string;
  initialValue?: string;
}

export function SymbolSearch({
  onSelectSymbol,
  placeholder = 'ค้นหาหุ้นหรือ ETF (เช่น AAPL, VOO, QQQ)...',
  initialValue = '',
}: SymbolSearchProps) {
  const [query, setQuery] = useState(initialValue);
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

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
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
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900 p-1 shadow-xl">
          {results.length === 0 && !isLoading ? (
            <div className="p-3 text-center text-xs text-slate-400">
              ไม่พบหลักทรัพย์ที่ตรงกับ &quot;{query}&quot;
            </div>
          ) : (
            results.map((item) => (
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
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-medium uppercase text-slate-300">
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
