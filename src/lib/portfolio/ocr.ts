/**
 * AI OCR Extraction Simulation Handler for Portfolio Statements and Screenshots.
 *
 * Scans uploaded documents (PDF, PNG, JPG), performs simulated OCR extraction,
 * and extracts asset symbols, quantities, average costs, sector allocations,
 * and portfolio weights for review and analytics.
 *
 * STRICTLY NON-TRANSACTIONAL: Extracts tracking & analytics data only.
 */

export interface ExtractedAssetItem {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  assetType: 'stock' | 'etf' | 'mutual_fund' | 'bond' | 'reit' | 'crypto' | 'cash' | 'option';
  sector: string;
  weightPercent: number;
}

export interface OcrextractedData {
  fileName: string;
  mimeType: string;
  extractedAt: string;
  extractedAssets: ExtractedAssetItem[];
  totalExtractedValue: number;
  aiInsights: {
    summary: string;
    diversificationRating: string;
    healthScoreSuggestion: number;
    recommendedTechWeight: number;
    recommendedIndexWeight: number;
  };
}

const DEFAULT_EXTRACTED_ASSETS: ExtractedAssetItem[] = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    quantity: 120,
    averageCost: 118.5,
    assetType: 'stock',
    sector: 'Information Technology',
    weightPercent: 32.5,
  },
  {
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    quantity: 85,
    averageCost: 510.2,
    assetType: 'etf',
    sector: 'Broad Index',
    weightPercent: 41.2,
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    quantity: 90,
    averageCost: 220.0,
    assetType: 'stock',
    sector: 'Information Technology',
    weightPercent: 18.3,
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust Series 1',
    quantity: 20,
    averageCost: 475.0,
    assetType: 'etf',
    sector: 'Technology Index',
    weightPercent: 8.0,
  },
];

/**
 * Simulates intelligent AI OCR processing on uploaded file metadata and contents.
 */
export async function simulateAiOcrExtraction(
  fileName: string,
  mimeType: string,
): Promise<OcrextractedData> {
  // Simulate network/AI parsing latency
  await new Promise((resolve) => setTimeout(resolve, 800));

  const lowerName = fileName.toLowerCase();

  let selectedAssets: ExtractedAssetItem[];

  if (lowerName.includes('tech') || lowerName.includes('growth')) {
    selectedAssets = [
      {
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        quantity: 150,
        averageCost: 112.0,
        assetType: 'stock',
        sector: 'Information Technology',
        weightPercent: 40.0,
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        quantity: 45,
        averageCost: 410.0,
        assetType: 'stock',
        sector: 'Information Technology',
        weightPercent: 35.0,
      },
      {
        symbol: 'QQQ',
        name: 'Invesco QQQ Trust',
        quantity: 30,
        averageCost: 480.0,
        assetType: 'etf',
        sector: 'Technology Index',
        weightPercent: 25.0,
      },
    ];
  } else if (lowerName.includes('etf') || lowerName.includes('index') || lowerName.includes('passive')) {
    selectedAssets = [
      {
        symbol: 'VOO',
        name: 'Vanguard S&P 500 ETF',
        quantity: 120,
        averageCost: 520.0,
        assetType: 'etf',
        sector: 'Broad Index',
        weightPercent: 55.0,
      },
      {
        symbol: 'SPY',
        name: 'SPDR S&P 500 ETF Trust',
        quantity: 50,
        averageCost: 570.0,
        assetType: 'etf',
        sector: 'Broad Index',
        weightPercent: 30.0,
      },
      {
        symbol: 'QQQ',
        name: 'Invesco QQQ Trust',
        quantity: 20,
        averageCost: 485.0,
        assetType: 'etf',
        sector: 'Technology Index',
        weightPercent: 15.0,
      },
    ];
  } else {
    selectedAssets = DEFAULT_EXTRACTED_ASSETS;
  }

  const totalExtractedValue = selectedAssets.reduce(
    (acc, item) => acc + item.quantity * item.averageCost,
    0,
  );

  return {
    fileName,
    mimeType,
    extractedAt: new Date().toISOString(),
    extractedAssets: selectedAssets,
    totalExtractedValue,
    aiInsights: {
      summary: `AI OCR สแกนเอกสาร "${fileName}" สำเร็จ: สกัดข้อมูลสินทรัพย์ได้ ${selectedAssets.length} รายการ (มูลค่ารวมประเมิน $${totalExtractedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
      diversificationRating: 'ดีเยี่ยม (High Quality)',
      healthScoreSuggestion: 90,
      recommendedTechWeight: 38.0,
      recommendedIndexWeight: 52.0,
    },
  };
}
