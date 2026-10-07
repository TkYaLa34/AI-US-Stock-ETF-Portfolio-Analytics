'use server';

/**
 * Server action for searching US stocks and ETFs.
 *
 * Supports matching both ticker symbols (e.g., AAPL, SPY, VOO, QQQ, NVDA)
 * and full company or ETF fund names across US market equities.
 */

export interface MarketSymbolResult {
  symbol: string;
  name: string;
  assetType: 'stock' | 'etf';
  exchange: string;
  currency: string;
}

const COMPREHENSIVE_US_MARKET_TICKERS: readonly MarketSymbolResult[] = [
  // ETFs
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', assetType: 'etf', exchange: 'NYSE Arca', currency: 'USD' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', assetType: 'etf', exchange: 'NYSE Arca', currency: 'USD' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust Series 1', assetType: 'etf', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'IVV', name: 'iShares Core S&P 500 ETF', assetType: 'etf', exchange: 'NYSE Arca', currency: 'USD' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', assetType: 'etf', exchange: 'NYSE Arca', currency: 'USD' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF', assetType: 'etf', exchange: 'NYSE Arca', currency: 'USD' },
  { symbol: 'EEM', name: 'iShares MSCI Emerging Markets ETF', assetType: 'etf', exchange: 'NYSE Arca', currency: 'USD' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', assetType: 'etf', exchange: 'NYSE Arca', currency: 'USD' },

  // Megacap & Tech
  { symbol: 'AAPL', name: 'Apple Inc.', assetType: 'stock', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', assetType: 'stock', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', assetType: 'stock', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', assetType: 'stock', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', assetType: 'stock', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'GOOG', name: 'Alphabet Inc. Class C', assetType: 'stock', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'META', name: 'Meta Platforms Inc.', assetType: 'stock', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'TSLA', name: 'Tesla Inc.', assetType: 'stock', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', assetType: 'stock', exchange: 'NASDAQ', currency: 'USD' },

  // Financials & Healthcare
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', assetType: 'stock', exchange: 'NYSE', currency: 'USD' },
  { symbol: 'V', name: 'Visa Inc.', assetType: 'stock', exchange: 'NYSE', currency: 'USD' },
  { symbol: 'MA', name: 'Mastercard Incorporated', assetType: 'stock', exchange: 'NYSE', currency: 'USD' },
  { symbol: 'LLY', name: 'Eli Lilly and Company', assetType: 'stock', exchange: 'NYSE', currency: 'USD' },
  { symbol: 'UNH', name: 'UnitedHealth Group Incorporated', assetType: 'stock', exchange: 'NYSE', currency: 'USD' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', assetType: 'stock', exchange: 'NYSE', currency: 'USD' },
  { symbol: 'BAC', name: 'Bank of America Corporation', assetType: 'stock', exchange: 'NYSE', currency: 'USD' },

  // Consumer & Energy
  { symbol: 'WMT', name: 'Walmart Inc.', assetType: 'stock', exchange: 'NYSE', currency: 'USD' },
  { symbol: 'PG', name: 'Procter & Gamble Company', assetType: 'stock', exchange: 'NYSE', currency: 'USD' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', assetType: 'stock', exchange: 'NYSE', currency: 'USD' },
  { symbol: 'HD', name: 'Home Depot Inc.', assetType: 'stock', exchange: 'NYSE', currency: 'USD' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation', assetType: 'stock', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'KO', name: 'The Coca-Cola Company', assetType: 'stock', exchange: 'NYSE', currency: 'USD' },
  { symbol: 'PEP', name: 'PepsiCo Inc.', assetType: 'stock', exchange: 'NASDAQ', currency: 'USD' },
];

export async function searchUSMarketSymbolsAction(query: string): Promise<MarketSymbolResult[]> {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) {
    return [];
  }

  // Prefix match on symbol gets priority, followed by name substring match.
  const prefixMatches = COMPREHENSIVE_US_MARKET_TICKERS.filter((item) =>
    item.symbol.toLowerCase().startsWith(trimmed),
  );

  const nameMatches = COMPREHENSIVE_US_MARKET_TICKERS.filter(
    (item) =>
      !item.symbol.toLowerCase().startsWith(trimmed) &&
      (item.name.toLowerCase().includes(trimmed) || item.symbol.toLowerCase().includes(trimmed)),
  );

  return [...prefixMatches, ...nameMatches].slice(0, 10);
}
