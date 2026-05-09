"""Tests for the POST /api/chat endpoint in mock mode."""

import os

os.environ["LLM_MOCK"] = "true"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest_asyncio.fixture
async def client(tmp_path):
    """Async test client with a fresh per-test SQLite DB."""
    import app.database as database

    db_file = str(tmp_path / "test.db")
    database.DB_PATH = db_file
    await database.init_db()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


async def test_chat_greeting(client):
    resp = await client.post("/api/chat", json={"message": "hello"})
    assert resp.status_code == 200
    data = resp.json()
    assert "FinAlly" in data["message"]
    assert data["trades"] is None
    assert data["watchlist_changes"] is None


async def test_chat_buy_aapl(client):
    """Mock buy always buys 10 shares of the matched ticker at $150."""
    resp = await client.post("/api/chat", json={"message": "buy some AAPL"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["trades"] is not None
    assert len(data["trades"]) == 1
    trade = data["trades"][0]
    assert trade["ticker"] == "AAPL"
    assert trade["side"] == "buy"
    assert trade["quantity"] == 10
    # No errors appended
    assert "Errors" not in data["message"]


async def test_chat_sell_insufficient(client):
    """Selling without owning shares should report error in message."""
    resp = await client.post("/api/chat", json={"message": "sell some AAPL"})
    assert resp.status_code == 200
    data = resp.json()
    # Upstream appends errors to message
    assert "Insufficient" in data["message"] or "Errors" in data["message"]


async def test_chat_buy_then_sell(client):
    """Buy then sell should succeed."""
    # Buy first (10 shares at $150 = $1500)
    resp = await client.post("/api/chat", json={"message": "buy some TSLA"})
    data = resp.json()
    assert data["trades"][0]["ticker"] == "TSLA"
    assert "Errors" not in data["message"]

    # Sell (10 shares at avg cost)
    resp = await client.post("/api/chat", json={"message": "sell some TSLA"})
    data = resp.json()
    assert "Insufficient" not in data["message"]


async def test_chat_buy_insufficient_cash(client):
    """Buying more than cash allows should fail. 10 * $150 = $1500, so
    need to exhaust cash first."""
    # Buy 7 times: 7 * 10 * $150 = $10,500 > $10,000
    # First 6 buys: 6 * $1500 = $9000 (leaving $1000)
    for _ in range(6):
        await client.post("/api/chat", json={"message": "buy some AAPL"})

    # 7th buy: $1500 > $1000 remaining
    resp = await client.post("/api/chat", json={"message": "buy some AAPL"})
    data = resp.json()
    assert "Insufficient" in data["message"]


async def test_chat_watchlist_add(client):
    resp = await client.post("/api/chat", json={"message": "add PYPL to watchlist"})
    data = resp.json()
    assert data["watchlist_changes"] is not None
    assert data["watchlist_changes"][0]["ticker"] == "PYPL"
    assert data["watchlist_changes"][0]["action"] == "add"


async def test_chat_watchlist_remove(client):
    resp = await client.post("/api/chat", json={"message": "remove NFLX"})
    data = resp.json()
    assert data["watchlist_changes"] is not None
    assert data["watchlist_changes"][0]["ticker"] == "NFLX"
    assert data["watchlist_changes"][0]["action"] == "remove"


async def test_chat_portfolio_query(client):
    resp = await client.post("/api/chat", json={"message": "show my portfolio"})
    data = resp.json()
    assert "portfolio" in data["message"].lower()
    assert data["trades"] is None


async def test_chat_fallback(client):
    resp = await client.post("/api/chat", json={"message": "random nonsense xyz"})
    data = resp.json()
    assert "trade" in data["message"].lower() or "portfolio" in data["message"].lower()


# ---------------------------------------------------------------------------
# Structured-output parsing
# ---------------------------------------------------------------------------


def test_parse_llm_content_happy_path():
    """Valid JSON with all fields parses into ChatResponse."""
    from app.chat import _parse_llm_content

    payload = (
        '{"message": "Buying AAPL", '
        '"trades": [{"ticker": "AAPL", "side": "buy", "quantity": 5}], '
        '"watchlist_changes": [{"ticker": "PYPL", "action": "add"}]}'
    )
    result = _parse_llm_content(payload)
    assert result.message == "Buying AAPL"
    assert result.trades is not None and len(result.trades) == 1
    assert result.trades[0].ticker == "AAPL"
    assert result.trades[0].side == "buy"
    assert result.trades[0].quantity == 5
    assert result.watchlist_changes is not None
    assert result.watchlist_changes[0].action == "add"


def test_parse_llm_content_message_only():
    """Minimal valid JSON (just message) parses with optional fields None."""
    from app.chat import _parse_llm_content

    result = _parse_llm_content('{"message": "Hello there."}')
    assert result.message == "Hello there."
    assert result.trades is None
    assert result.watchlist_changes is None


def test_parse_llm_content_malformed_json():
    """Malformed JSON falls back to surfacing raw content, not raising."""
    from app.chat import _parse_llm_content

    raw = "not even close to JSON"
    result = _parse_llm_content(raw)
    assert result.message == raw
    assert result.trades is None
    assert result.watchlist_changes is None


def test_parse_llm_content_invalid_schema():
    """JSON that is missing required fields falls back gracefully."""
    from app.chat import _parse_llm_content

    # Valid JSON but missing the required `message` field
    raw = '{"trades": [{"ticker": "AAPL", "side": "buy", "quantity": 1}]}'
    result = _parse_llm_content(raw)
    # Falls back to surfacing raw text
    assert result.message == raw
    assert result.trades is None
