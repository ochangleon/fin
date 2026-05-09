"""Watchlist API routes."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.database import get_db
from app.market.cache import price_cache

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

USER_ID = "default"


class AddTickerRequest(BaseModel):
    ticker: str


class WatchlistItem(BaseModel):
    ticker: str
    price: float | None = None
    previous_price: float | None = None
    change_percent: float | None = None


def _to_item(ticker: str) -> WatchlistItem:
    """Build a WatchlistItem from the latest cached price (if any)."""
    update = price_cache.get(ticker)
    if not update:
        return WatchlistItem(ticker=ticker)
    prev = update.previous_price
    change_pct = ((update.price - prev) / prev * 100) if prev else None
    return WatchlistItem(
        ticker=ticker,
        price=update.price,
        previous_price=prev,
        change_percent=round(change_pct, 2) if change_pct is not None else None,
    )


@router.get("", response_model=list[WatchlistItem])
async def get_watchlist():
    """Return watchlist tickers with latest prices from the price cache."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY added_at",
            (USER_ID,),
        )
        rows = await cursor.fetchall()
        return [_to_item(row["ticker"]) for row in rows]
    finally:
        await db.close()


@router.post("", response_model=WatchlistItem)
async def add_ticker(body: AddTickerRequest, request: Request):
    """Add a ticker to the watchlist (idempotent, uppercase normalized)."""
    ticker = body.ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")

    db = await get_db()
    try:
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "INSERT OR IGNORE INTO watchlist (id, user_id, ticker, added_at) "
            "VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), USER_ID, ticker, now),
        )
        await db.commit()
    finally:
        await db.close()

    provider = getattr(request.app.state, "market_provider", None)
    if provider is not None:
        provider.add_ticker(ticker)

    return _to_item(ticker)


@router.delete("/{ticker}")
async def remove_ticker(ticker: str):
    """Remove a ticker from the watchlist."""
    ticker = ticker.upper().strip()
    db = await get_db()
    try:
        cursor = await db.execute(
            "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
            (USER_ID, ticker),
        )
        await db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"{ticker} not in watchlist")
        return {"ok": True}
    finally:
        await db.close()
