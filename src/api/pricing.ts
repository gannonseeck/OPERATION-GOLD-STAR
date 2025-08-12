import express from 'express';
import { getAdapter } from '../pricingEngine.js';

const router = express.Router();

router.post('/quote', async (req, res) => {
  const { cardId } = req.body || {};
  if (!cardId) {
    return res.status(400).json({ error: 'cardId required' });
  }
  try {
    const adapter = getAdapter();
    const result = await adapter.getByCardId(cardId);
    const offer = result.market_price != null ? Number((0.8 * result.market_price).toFixed(2)) : null;
    res.json({ market_price: result.market_price, graded_prices: result.graded_prices, explain: result.explain, offer });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
