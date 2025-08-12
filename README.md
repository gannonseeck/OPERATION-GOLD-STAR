# Pricing Quote Service

This project exposes a `POST /pricing/quote` endpoint for obtaining market and offer prices for Pokémon cards.

## Endpoint
`POST /pricing/quote`

Request body:
```json
{ "psa_cert": "optional", "cardId": "optional", "setId": "optional", "number": "optional", "name": "optional", "includeHistory": true }
```
At least one identifier is required.

Response example:
```json
{
  "market_price": 120.0,
  "offer_price": 96.0,
  "graded_prices": {"PSA10": 350.0, "PSA9": 180.0},
  "confidence": 0.72,
  "explain": {
    "windowDays": 30,
    "sampleSize": 27,
    "variance": 0.18,
    "sources": ["tcgplayer","ebay"],
    "trend": "flat",
    "notes": []
  }
}
```
If confidence is below `0.6` the service returns `{"no_offer": true, "reason": "low_confidence"}` instead of `offer_price`.

### Confidence policy
Confidence is a weighted score of sample size, recency, price variance and source diversity. Low sample size, stale or volatile data reduce confidence.

### Trend guard
The offer price is normally `80%` of market price. If 7‑day median price drops more than 10% vs 30‑day median, the multiplier is reduced by `0.025` per 10% step. Spikes >15% cap the multiplier at `0.78`.

### Caching & Rate limit
Quotes are cached for 10 minutes by lookup key. Use `forceRefresh=true` to bypass cache. Clients are limited to 30 requests per minute by IP.

## cURL example
```
curl -X POST http://localhost:8000/pricing/quote \
  -H 'Content-Type: application/json' \
  -d '{"name":"Pikachu"}'
```
