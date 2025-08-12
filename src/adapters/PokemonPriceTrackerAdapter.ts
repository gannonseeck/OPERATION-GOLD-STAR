import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import Bottleneck from 'bottleneck';
import { PricingAdapter, PricingResult, SearchResult } from '../types.js';

interface PriceRecord {
  tcgplayer?: { low?: number; mid?: number; market?: number; high?: number };
  cardmarket?: { low?: number; mid?: number; market?: number; high?: number; trendPrice?: number; averageSellPrice?: number };
  ebay?: { prices?: Record<string, number> };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function filterOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length / 4)];
  const q3 = sorted[Math.floor((sorted.length * 3) / 4)];
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  return values.filter((v) => v >= low && v <= high);
}

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = average(values);
  return average(values.map((v) => (v - avg) ** 2));
}

export class PokemonPriceTrackerAdapter implements PricingAdapter {
  private client: AxiosInstance;
  private limiter: Bottleneck;

  constructor(config?: { baseURL?: string; timeoutMs?: number; maxRetries?: number; rpm?: number }) {
    const baseURL = config?.baseURL ?? 'https://www.pokemonpricetracker.com/api';
    const timeout = config?.timeoutMs ?? 5000;
    const maxRetries = config?.maxRetries ?? 2;
    const rpm = config?.rpm ?? 50;

    this.client = axios.create({ baseURL, timeout });
    const key = process.env.PPT_API_KEY;
    if (key) this.client.defaults.headers.common['Authorization'] = `Bearer ${key}`;

    axiosRetry(this.client, {
      retries: maxRetries,
      retryCondition: (e) => {
        const status = e.response?.status;
        return status === 429 || axiosRetry.isNetworkOrIdempotentRequestError(e);
      },
      retryDelay: (count, error) => {
        const retryAfter = Number(error.response?.headers['retry-after']);
        if (retryAfter) return retryAfter * 1000;
        return axiosRetry.exponentialDelay(count);
      },
    });

    this.client.interceptors.response.use((resp) => {
      const remaining = resp.headers['x-ratelimit-remaining'];
      const reset = resp.headers['x-ratelimit-reset'];
      if (remaining !== undefined) {
        console.log(`PokemonPriceTracker rate limit remaining: ${remaining}; reset: ${reset}`);
      }
      return resp;
    });

    this.limiter = new Bottleneck({
      reservoir: rpm,
      reservoirRefreshAmount: rpm,
      reservoirRefreshInterval: 60 * 1000,
      maxConcurrent: 1,
    });
  }

  private async get(path: string, params?: Record<string, any>) {
    return this.limiter.schedule(() => this.client.get(path, { params }));
  }

  async getByCardId(cardId: string, opts?: { includeHistory?: boolean }): Promise<PricingResult> {
    try {
      const priceResp = await this.get('/prices', { id: cardId });
      if (!priceResp.data || priceResp.data.length === 0) {
        return { cardId, sources: [], market_price: null, explain: { sampleSize: 0, windowDays: 0, variance: 0, hasPSA: false, noData: true } };
      }
      const priceData = priceResp.data[0];
      let history: PricingResult['history'];
      if (opts?.includeHistory) {
        const [rawHist, psaHist] = await Promise.all([
          this.get(`/cards/${cardId}/history`, { type: 'raw' }).catch(() => ({ data: [] })),
          this.get(`/cards/${cardId}/history`, { type: 'psa' }).catch(() => ({ data: [] })),
        ]);
        history = [];
        for (const h of rawHist.data ?? []) history.push({ date: h.date, price: h.price, type: 'raw' });
        for (const h of psaHist.data ?? []) history.push({ date: h.date, price: h.price, type: 'psa' });
      }
      return this.mapResult(cardId, priceData, history);
    } catch (e: any) {
      const status = e.response?.status;
      if (status === 401) throw new Error('Missing or invalid API key');
      if (status === 404) return { cardId, sources: [], market_price: null, explain: { sampleSize: 0, windowDays: 0, variance: 0, hasPSA: false, noData: true } };
      throw e;
    }
  }

  async findBySetAndNumber(setId: string, number: string, opts?: { includeHistory?: boolean }): Promise<PricingResult> {
    const priceResp = await this.get('/prices', { setId, number });
    if (!priceResp.data || priceResp.data.length === 0) {
      return { cardId: '', sources: [], market_price: null, explain: { sampleSize: 0, windowDays: 0, variance: 0, hasPSA: false, noData: true } };
    }
    const cardId = priceResp.data[0].id;
    let history: PricingResult['history'];
    if (opts?.includeHistory) {
      const [rawHist, psaHist] = await Promise.all([
        this.get(`/cards/${cardId}/history`, { type: 'raw' }).catch(() => ({ data: [] })),
        this.get(`/cards/${cardId}/history`, { type: 'psa' }).catch(() => ({ data: [] })),
      ]);
      history = [];
      for (const h of rawHist.data ?? []) history.push({ date: h.date, price: h.price, type: 'raw' });
      for (const h of psaHist.data ?? []) history.push({ date: h.date, price: h.price, type: 'psa' });
    }
    return this.mapResult(cardId, priceResp.data[0], history);
  }

  async findByName(name: string, limit = 5): Promise<SearchResult[]> {
    const resp = await this.get('/prices', { name, limit });
    return (resp.data || []).map((p: any) => ({ cardId: p.id, name: p.name, setName: p.setName }));
  }

  private mapResult(cardId: string, priceData: any, history?: PricingResult['history']): PricingResult {
    const prices: PriceRecord = priceData.prices || {};
    const sources = Object.keys(prices) as Array<'tcgplayer' | 'cardmarket' | 'ebay'>;

    const graded = prices.ebay?.prices ?? {};
    const graded_prices: Record<'PSA10' | 'PSA9' | 'PSA8', number | undefined> = {
      PSA10: graded['PSA10'],
      PSA9: graded['PSA9'],
      PSA8: graded['PSA8'],
    };
    const gradedVals = Object.values(graded_prices).filter((v): v is number => typeof v === 'number');

    const raw_prices = prices.tcgplayer || prices.cardmarket ? {
      low: prices.tcgplayer?.low ?? prices.cardmarket?.low,
      mid: prices.tcgplayer?.mid ?? prices.cardmarket?.mid,
      market: prices.tcgplayer?.market ?? prices.cardmarket?.market ?? prices.cardmarket?.trendPrice,
      high: prices.tcgplayer?.high ?? prices.cardmarket?.high,
    } : undefined;

    let market_price: number | null = null;
    const rawVals: number[] = [];
    if (prices.tcgplayer) rawVals.push(...Object.values(prices.tcgplayer).filter((v): v is number => typeof v === 'number'));
    if (prices.cardmarket) rawVals.push(...Object.values(prices.cardmarket).filter((v): v is number => typeof v === 'number'));

    const filteredRaw = filterOutliers(rawVals);
    if (prices.tcgplayer?.market) market_price = prices.tcgplayer.market;
    else if (filteredRaw.length) market_price = average(filteredRaw);
    else if (gradedVals.length) market_price = median(gradedVals);
    else market_price = null;

    let windowDays = 0;
    if (history && history.length > 1) {
      const start = new Date(history[0].date).getTime();
      const end = new Date(history[history.length - 1].date).getTime();
      windowDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
    }

    const explain = {
      sampleSize: filteredRaw.length || gradedVals.length,
      windowDays,
      variance: variance(filteredRaw.length ? filteredRaw : gradedVals),
      hasPSA: gradedVals.length > 0,
      ...(market_price === null ? { noData: true } : {}),
    };

    return {
      cardId,
      sources,
      market_price,
      graded_prices: gradedVals.length ? graded_prices : undefined,
      raw_prices,
      history,
      explain,
    };
  }
}
