import MockAdapter from 'axios-mock-adapter';
import { PokemonPriceTrackerAdapter } from '../src/adapters/PokemonPriceTrackerAdapter.js';

function makeAdapter() {
  process.env.PPT_API_KEY = 'test';
  const adapter = new PokemonPriceTrackerAdapter({ baseURL: 'http://mock.api' });
  const mock = new MockAdapter((adapter as any).client);
  return { adapter, mock };
}

describe('PokemonPriceTrackerAdapter', () => {
  test('raw only market price', async () => {
    const { adapter, mock } = makeAdapter();
    mock.onGet('/prices').reply(200, [{ id: 'abc', prices: { tcgplayer: { low: 10, mid: 20, market: 30, high: 40 } } }]);
    const res = await adapter.getByCardId('abc');
    expect(res.market_price).toBe(30);
    expect(res.raw_prices?.market).toBe(30);
  });

  test('graded only median', async () => {
    const { adapter, mock } = makeAdapter();
    mock.onGet('/prices').reply(200, [{ id: 'abc', prices: { ebay: { prices: { PSA10: 100, PSA9: 80 } } } }]);
    const res = await adapter.getByCardId('abc');
    expect(res.market_price).toBe(90);
    expect(res.graded_prices?.PSA10).toBe(100);
  });

  test('graded mapping with raw', async () => {
    const { adapter, mock } = makeAdapter();
    mock.onGet('/prices').reply(200, [{ id: 'abc', prices: { tcgplayer: { market: 50 }, ebay: { prices: { PSA10: 100, PSA9: 80 } } } }]);
    const res = await adapter.getByCardId('abc');
    expect(res.market_price).toBe(50);
    expect(res.graded_prices?.PSA9).toBe(80);
  });

  test('404 returns no data', async () => {
    const { adapter, mock } = makeAdapter();
    mock.onGet('/prices').reply(404);
    const res = await adapter.getByCardId('missing');
    expect(res.market_price).toBeNull();
    expect(res.explain.noData).toBe(true);
  });

  test('retries on 429', async () => {
    const { adapter, mock } = makeAdapter();
    mock.onGet('/prices').replyOnce(429, {}, { 'retry-after': '0' });
    mock.onGet('/prices').replyOnce(200, [{ id: 'abc', prices: { tcgplayer: { market: 25 } } }]);
    const res = await adapter.getByCardId('abc');
    expect(res.market_price).toBe(25);
    expect(mock.history.get.length).toBe(2);
  });

  test('outlier filtering', async () => {
    const { adapter, mock } = makeAdapter();
    mock.onGet('/prices').reply(200, [{
      id: 'abc',
      prices: {
        tcgplayer: { low: 10, mid: 20, high: 1000 },
        cardmarket: { low: 9, mid: 19, market: 28, high: 1005, trendPrice: 22, averageSellPrice: 23 },
      },
    }]);
    const res = await adapter.getByCardId('abc');
    expect(res.market_price).toBeCloseTo(18.7, 1);
  });
});
