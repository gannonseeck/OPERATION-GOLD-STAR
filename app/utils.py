from __future__ import annotations
from typing import List, Dict, Tuple
from statistics import median
import math
from datetime import datetime, timedelta


def sample_size_score(n: int) -> float:
    points = [(0, 0.0), (5, 0.4), (20, 0.7), (50, 0.9)]
    if n <= 0:
        return 0.0
    if n >= 50:
        return 0.9
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        if x1 <= n <= x2:
            ratio = (n - x1) / (x2 - x1)
            return y1 + ratio * (y2 - y1)
    return 0.0


def recency_score(comps: List[Dict]) -> float:
    now = datetime.utcnow()
    seven = now - timedelta(days=7)
    thirty = now - timedelta(days=30)
    total30 = sum(1 for c in comps if c['date'] >= thirty)
    total7 = sum(1 for c in comps if c['date'] >= seven)
    if total30 == 0:
        return 0.4
    pct = total7 / total30
    if pct >= 0.5:
        return 1.0
    return 0.7 if total7 > 0 else 0.4


def variance_score(comps: List[Dict]) -> float:
    prices = [c['price'] for c in comps]
    if not prices:
        return 0.0
    med = median(prices)
    if med == 0:
        return 0.0
    mad = median([abs(p - med) for p in prices])
    normalized = mad / med
    return max(0.0, min(1.0, 1 - normalized))


def source_diversity_score(comps: List[Dict]) -> float:
    sources = {c['source'] for c in comps}
    return 1.0 if len(sources) >= 2 else 0.6


def compute_confidence(comps: List[Dict]) -> Tuple[float, Dict]:
    n = len(comps)
    sample = sample_size_score(n)
    recency = recency_score(comps)
    variance = variance_score(comps)
    diversity = source_diversity_score(comps)
    confidence = (
        0.35 * sample + 0.25 * recency + 0.25 * variance + 0.15 * diversity
    )
    explain = {
        'sampleSize': n,
        'variance': round(variance_score(comps), 2),
        'sources': sorted({c['source'] for c in comps})
    }
    return round(confidence, 2), explain


def trend_and_multiplier(prices7: List[float], prices30: List[float], base_multiplier: float = 0.80) -> Tuple[str, float]:
    med7 = median(prices7) if prices7 else None
    med30 = median(prices30) if prices30 else None
    trend = 'flat'
    multiplier = base_multiplier
    if med7 and med30:
        if med7 < med30 * 0.9:
            trend = 'down'
            decline = (med30 - med7) / med30
            steps = math.floor(decline / 0.10)
            multiplier -= steps * 0.025
        elif med7 > med30 * 1.15:
            trend = 'up'
            multiplier = min(multiplier, 0.78)
        else:
            trend = 'flat'
    return trend, multiplier
