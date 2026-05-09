"""Tests for watchlist endpoints: GET, POST (idempotent + uppercase), DELETE."""

import pytest

from app.market.cache import price_cache
from app.market.simulator import Simulator


@pytest.fixture
def fake_provider():
    """Attach a Simulator to the app so POST can register new tickers."""
    from app.main import app

    sim = Simulator()
    sim._started = True  # cache-seed on add_ticker even without start()
    app.state.market_provider = sim
    yield sim
    app.state.market_provider = None
    price_cache._prices.clear()


@pytest.fixture
def seed_prices():
    price_cache.update("AAPL", 190.0)
    price_cache.update("AAPL", 195.0)  # second update so previous_price differs
    price_cache.update("GOOGL", 175.0)
    yield
    price_cache._prices.clear()


@pytest.mark.asyncio
async def test_get_watchlist_returns_default_tickers(client, fake_provider, seed_prices):
    resp = await client.get("/api/watchlist")
    assert resp.status_code == 200
    data = resp.json()
    tickers = [item["ticker"] for item in data]
    assert "AAPL" in tickers
    assert "GOOGL" in tickers
    assert len(tickers) == 10  # default seed


@pytest.mark.asyncio
async def test_get_watchlist_includes_prices(client, fake_provider, seed_prices):
    resp = await client.get("/api/watchlist")
    aapl = next(item for item in resp.json() if item["ticker"] == "AAPL")
    assert aapl["price"] == 195.0
    assert aapl["previous_price"] == 190.0
    assert aapl["change_percent"] is not None


@pytest.mark.asyncio
async def test_add_ticker(client, fake_provider):
    resp = await client.post("/api/watchlist", json={"ticker": "WMT"})
    assert resp.status_code == 200
    assert resp.json()["ticker"] == "WMT"

    resp = await client.get("/api/watchlist")
    assert "WMT" in [item["ticker"] for item in resp.json()]


@pytest.mark.asyncio
async def test_add_ticker_normalizes_case(client, fake_provider):
    resp = await client.post("/api/watchlist", json={"ticker": "wmt"})
    assert resp.status_code == 200
    assert resp.json()["ticker"] == "WMT"

    resp = await client.get("/api/watchlist")
    tickers = [item["ticker"] for item in resp.json()]
    assert "WMT" in tickers
    assert "wmt" not in tickers


@pytest.mark.asyncio
async def test_add_duplicate_is_no_op(client, fake_provider):
    r1 = await client.post("/api/watchlist", json={"ticker": "WMT"})
    assert r1.status_code == 200
    r2 = await client.post("/api/watchlist", json={"ticker": "WMT"})
    assert r2.status_code == 200

    r3 = await client.post("/api/watchlist", json={"ticker": "wmt"})
    assert r3.status_code == 200

    resp = await client.get("/api/watchlist")
    tickers = [item["ticker"] for item in resp.json()]
    assert tickers.count("WMT") == 1


@pytest.mark.asyncio
async def test_add_empty_ticker_rejected(client, fake_provider):
    resp = await client.post("/api/watchlist", json={"ticker": "  "})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_add_ticker_registers_with_provider(client, fake_provider):
    """New ticker should be tracked by the provider so it appears in SSE."""
    assert "WMT" not in fake_provider._tickers

    resp = await client.post("/api/watchlist", json={"ticker": "WMT"})
    assert resp.status_code == 200

    assert "WMT" in fake_provider._tickers
    # Provider seeded the cache so SSE picks it up immediately
    assert price_cache.get("WMT") is not None


@pytest.mark.asyncio
async def test_remove_ticker(client, fake_provider):
    resp = await client.delete("/api/watchlist/AAPL")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    resp = await client.get("/api/watchlist")
    assert "AAPL" not in [item["ticker"] for item in resp.json()]


@pytest.mark.asyncio
async def test_remove_ticker_normalizes_case(client, fake_provider):
    resp = await client.delete("/api/watchlist/aapl")
    assert resp.status_code == 200

    resp = await client.get("/api/watchlist")
    assert "AAPL" not in [item["ticker"] for item in resp.json()]


@pytest.mark.asyncio
async def test_remove_nonexistent_ticker_404(client, fake_provider):
    resp = await client.delete("/api/watchlist/ZZZZZ")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_then_remove(client, fake_provider):
    await client.post("/api/watchlist", json={"ticker": "WMT"})
    resp = await client.delete("/api/watchlist/WMT")
    assert resp.status_code == 200

    resp = await client.get("/api/watchlist")
    assert "WMT" not in [item["ticker"] for item in resp.json()]
