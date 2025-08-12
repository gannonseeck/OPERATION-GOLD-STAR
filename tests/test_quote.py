import time
from fastapi.testclient import TestClient
from app.main import app, CACHE, RATE_LIMIT, metrics
from app.adapter import PokemonPriceTrackerAdapter

client = TestClient(app)


def setup_function():
    CACHE.clear()
    RATE_LIMIT.clear()
    metrics['quote_cache_hits_total'] = 0
    from app import main
    main.adapter = PokemonPriceTrackerAdapter()


def test_quote_happy_path():
    resp = client.post("/pricing/quote", json={"name": "pikachu"})
    assert resp.status_code == 200
    data = resp.json()
    assert "offer_price" in data
    assert data["confidence"] >= 0


def test_low_confidence_no_offer(monkeypatch):
    async def fake_fetch(self, **kwargs):
        history = []
        return {"market_price": 100.0, "graded_prices": {}, "history": history, "adapterStatus": "ok"}
    monkeypatch.setattr(app.state if hasattr(app, 'state') else app, 'adapter', None, raising=False)
    from app import main
    monkeypatch.setattr(main, 'adapter', type('A', (), {'fetch': fake_fetch})())
    resp = client.post("/pricing/quote", json={"name": "charizard"})
    assert resp.status_code == 200
    assert resp.json().get("no_offer") is True


def test_rate_limit():
    for i in range(30):
        r = client.post("/pricing/quote", json={"name": f"card{i}"})
        assert r.status_code == 200
    r = client.post("/pricing/quote", json={"name": "overflow"})
    assert r.status_code == 429


def test_cache_hit_metric():
    client.post("/pricing/quote", json={"name": "zapdos"})
    assert metrics['quote_cache_hits_total'] == 0
    client.post("/pricing/quote", json={"name": "zapdos"})
    assert metrics['quote_cache_hits_total'] == 1
