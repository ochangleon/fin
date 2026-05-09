"""SQLite database with lazy initialization."""

import os
import uuid
from datetime import datetime, timezone

import aiosqlite

from db import DEFAULT_CASH_BALANCE, DEFAULT_TICKERS, DEFAULT_USER_ID, load_schema

__all__ = ["DB_PATH", "DEFAULT_TICKERS", "get_db", "init_db"]

DB_PATH = os.environ.get("DB_PATH", "/app/db/finally.db")


async def get_db() -> aiosqlite.Connection:
    """Open a connection to the configured SQLite database."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    return db


async def init_db() -> None:
    """Create schema and seed default data if the database is empty."""
    parent = os.path.dirname(DB_PATH)
    if parent:
        os.makedirs(parent, exist_ok=True)

    db = await get_db()
    try:
        await db.executescript(load_schema())

        cursor = await db.execute("SELECT COUNT(*) FROM users_profile")
        row = await cursor.fetchone()
        if row[0] == 0:
            now = datetime.now(timezone.utc).isoformat()
            await db.execute(
                "INSERT INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
                (DEFAULT_USER_ID, DEFAULT_CASH_BALANCE, now),
            )
            for ticker in DEFAULT_TICKERS:
                await db.execute(
                    "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                    (str(uuid.uuid4()), DEFAULT_USER_ID, ticker, now),
                )
            await db.commit()
    finally:
        await db.close()
