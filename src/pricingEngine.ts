import { PokemonPriceTrackerAdapter } from './adapters/PokemonPriceTrackerAdapter.js';
import { PricingAdapter } from './types.js';

const registry: Record<string, PricingAdapter> = {
  pokemonpricetracker: new PokemonPriceTrackerAdapter(),
};

export function getAdapter(): PricingAdapter {
  const key = process.env.PRICING_PRIMARY_SOURCE || 'pokemonpricetracker';
  const adapter = registry[key];
  if (!adapter) throw new Error(`Unknown pricing source: ${key}`);
  return adapter;
}
