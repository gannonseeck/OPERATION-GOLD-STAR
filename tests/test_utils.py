from datetime import datetime, timedelta
from app.utils import compute_confidence, trend_and_multiplier


def make_comp(price, days, source="tcgplayer"):
    return {"price": price, "date": datetime.utcnow() - timedelta(days=days), "source": source}


def test_confidence_scores():
    comps = [make_comp(100 + i, i, "s1" if i % 2 == 0 else "s2") for i in range(10)]
    confidence, explain = compute_confidence(comps)
    assert 0 <= confidence <= 1
    assert explain['sampleSize'] == 10


def test_trend_down_multiplier():
    prices7 = [100, 90]
    prices30 = [120, 110, 100]
    trend, mult = trend_and_multiplier(prices7, prices30)
    assert trend == 'down'
    assert mult < 0.80


def test_trend_spike_cap():
    prices7 = [130, 140]
    prices30 = [100, 110, 105]
    trend, mult = trend_and_multiplier(prices7, prices30)
    assert trend == 'up'
    assert mult == 0.78
