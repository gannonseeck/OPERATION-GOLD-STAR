import time
from typing import Dict
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from uuid import uuid4
from datetime import datetime, timedelta

from .models import PricingRequest, QuoteResponse, Explain
from .adapter import PokemonPriceTrackerAdapter
from .utils import compute_confidence, trend_and_multiplier

app = FastAPI()
adapter = PokemonPriceTrackerAdapter()

CACHE: Dict[str, Dict] = {}
RATE_LIMIT: Dict[str, list] = {}
TTL = 600

metrics = {
    'quote_requests_total': 0,
    'quote_cache_hits_total': 0,
    'quote_errors_total': 0,
}


def rate_limiter(request: Request):
    ip = request.client.host if request.client else 'anon'
    now = time.time()
    window = 60
    times = RATE_LIMIT.get(ip, [])
    times = [t for t in times if now - t < window]
    if len(times) >= 30:
        raise HTTPException(status_code=429, detail="rate limit")
    times.append(now)
    RATE_LIMIT[ip] = times


@app.post("/pricing/quote", response_model=QuoteResponse)
async def quote(req: PricingRequest, request: Request, forceRefresh: bool = False):
    rate_limiter(request)
    metrics['quote_requests_total'] += 1
    lookup = req.cardId or req.psa_cert or (f"{req.setId}-{req.number}" if req.setId and req.number else None) or req.name
    if not lookup:
        raise HTTPException(status_code=400, detail="bad input")
    cache_entry = CACHE.get(lookup)
    cache_hit = False
    timing = None
    if cache_entry and not forceRefresh and time.time() - cache_entry['time'] < TTL:
        cache_hit = True
        metrics['quote_cache_hits_total'] += 1
        data = cache_entry['data']
    else:
        start = time.time()
        data = await adapter.fetch(
            cardId=req.cardId,
            psa_cert=req.psa_cert,
            setId=req.setId,
            number=req.number,
            name=req.name,
            includeHistory=req.includeHistory,
        )
        CACHE[lookup] = {'time': time.time(), 'data': data}
        timing = time.time() - start
    comps = data.get('history', [])
    confidence, explain_extra = compute_confidence(comps)
    prices30 = [c['price'] for c in comps if c['date'] >= datetime.utcnow() - timedelta(days=30)]
    prices7 = [c['price'] for c in comps if c['date'] >= datetime.utcnow() - timedelta(days=7)]
    trend, multiplier = trend_and_multiplier(prices7, prices30)
    explain = Explain(windowDays=30, trend=trend, notes=[], **explain_extra)
    result = {
        'market_price': data['market_price'],
        'graded_prices': data.get('graded_prices', {}),
        'confidence': confidence,
        'explain': explain,
    }
    if confidence < 0.6:
        result['no_offer'] = True
        result['reason'] = 'low_confidence'
    else:
        offer = data['market_price'] * multiplier
        result['offer_price'] = round(offer, 2)
    log = {
        'requestId': str(uuid4()),
        'lookupKey': lookup,
        'confidence': confidence,
        'cacheHit': cache_hit,
        'adapterStatus': data.get('adapterStatus'),
        'timing': timing,
    }
    print(log)
    return result
