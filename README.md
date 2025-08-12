# Operation Gold Star Pricing

This repository contains a simple pricing engine that integrates with [PokemonPriceTracker](https://www.pokemonpricetracker.com/).

## Setup

1. Obtain an API key from PokemonPriceTracker and export it:

```bash
export PPT_API_KEY=your_key_here
```

2. Install dependencies and run tests:

```bash
npm install
npm test
```

## Example Request

A sample request to fetch prices for card `base1-4`:

```bash
curl -H "Authorization: Bearer $PPT_API_KEY" \
  "https://www.pokemonpricetracker.com/api/prices?id=base1-4"
```

The adapter enforces a default rate limit of 50 requests per minute, below the documented 60 RPM, and retries 429 responses with backoff.
