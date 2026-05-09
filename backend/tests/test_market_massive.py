"""Tests for the Massive (Polygon.io) REST client parsing."""

import httpx
import pytest

from app.market.cache import PriceCache


@pytest.fixture
def fake_snapshot():
    """A representative Polygon.io snapshot response."""
    return {
        "tickers": [
            {"ticker": "AAPL", "lastTrade": {"p": 191.50}},
            {"ticker": "GOOGL", "lastTrade": {"p": 175.25}},
            {"ticker": "MSFT", "lastTrade": {"p": 422.80}},
        ]
    }


@pytest.fixture
def isolated_cache(monkeypatch):
    """Replace the global price_cache with a fresh one for the test."""
    cache = PriceCache()
    import app.market.cache as cache_mod
    import app.market.massive as massive_mod
    monkeypatch.setattr(cache_mod, "price_cache", cache)
    monkeypatch.setattr(massive_mod, "price_cache", cache)
    return cache


@pytest.fixture
def massive_env(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "test-key")
    monkeypatch.setenv("MASSIVE_POLL_INTERVAL", "60")


async def _run_poll(tickers, handler):
    from app.market.massive import MassiveClient

    client = MassiveClient(tickers=tickers)
    client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    try:
        await client._poll()
    finally:
        await client._client.aclose()


async def test_poll_parses_snapshot_response(massive_env, isolated_cache, fake_snapshot):
    async def handler(request: httpx.Request):
        return httpx.Response(200, json=fake_snapshot)

    await _run_poll(["AAPL", "GOOGL", "MSFT"], handler)

    assert isolated_cache.get("AAPL").price == 191.50
    assert isolated_cache.get("GOOGL").price == 175.25
    assert isolated_cache.get("MSFT").price == 422.80


async def test_poll_sends_api_key_and_tickers(massive_env, isolated_cache, fake_snapshot):
    captured = {}

    async def handler(request: httpx.Request):
        captured["path"] = request.url.path
        captured["api_key"] = request.url.params.get("apiKey")
        captured["tickers"] = request.url.params.get("tickers")
        return httpx.Response(200, json=fake_snapshot)

    await _run_poll(["AAPL", "GOOGL"], handler)

    assert captured["path"] == "/v2/snapshot/locale/us/markets/stocks/tickers"
    assert captured["api_key"] == "test-key"
    assert captured["tickers"] == "AAPL,GOOGL"


async def test_poll_skips_entries_missing_last_trade(massive_env, isolated_cache):
    async def handler(request: httpx.Request):
        return httpx.Response(200, json={
            "tickers": [
                {"ticker": "AAPL", "lastTrade": {"p": 100.0}},
                {"ticker": "GOOGL"},  # no lastTrade
                {"ticker": "MSFT", "lastTrade": {}},  # no price
            ]
        })

    await _run_poll(["AAPL", "GOOGL", "MSFT"], handler)

    assert isolated_cache.get("AAPL").price == 100.0
    assert isolated_cache.get("GOOGL") is None
    assert isolated_cache.get("MSFT") is None


async def test_poll_swallows_http_errors(massive_env, isolated_cache):
    async def handler(request: httpx.Request):
        return httpx.Response(500, json={"error": "boom"})

    # Should not raise — errors are logged and the loop continues.
    await _run_poll(["AAPL"], handler)
    assert isolated_cache.get("AAPL") is None


async def test_poll_handles_empty_ticker_list_gracefully(massive_env, isolated_cache):
    async def handler(request: httpx.Request):
        return httpx.Response(200, json={"tickers": []})

    await _run_poll(["AAPL"], handler)
    assert isolated_cache.get("AAPL") is None
