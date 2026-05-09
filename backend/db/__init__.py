"""Schema definitions and seed data."""

from pathlib import Path

from .seed import DEFAULT_CASH_BALANCE, DEFAULT_TICKERS, DEFAULT_USER_ID

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def load_schema() -> str:
    """Read the schema SQL from disk."""
    return SCHEMA_PATH.read_text()


__all__ = ["DEFAULT_CASH_BALANCE", "DEFAULT_TICKERS", "DEFAULT_USER_ID", "load_schema"]
