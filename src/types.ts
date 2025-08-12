export interface PricingAdapter {
  getByCardId(cardId: string, opts?: { includeHistory?: boolean }): Promise<PricingResult>;
  findBySetAndNumber(setId: string, number: string, opts?: { includeHistory?: boolean }): Promise<PricingResult>;
  findByName(name: string, limit?: number): Promise<SearchResult[]>;
}

export type PricingResult = {
  cardId: string;
  sources: Array<'tcgplayer' | 'cardmarket' | 'ebay'>;
  market_price: number | null;
  graded_prices?: Record<'PSA10' | 'PSA9' | 'PSA8', number | undefined>;
  raw_prices?: { low?: number; mid?: number; market?: number; high?: number };
  history?: Array<{ date: string; price: number; type: 'psa' | 'raw' }>;
  explain: { sampleSize: number; windowDays: number; variance: number; hasPSA: boolean; noData?: boolean };
};

export type SearchResult = {
  cardId: string;
  name: string;
  setName?: string;
};
