"""Interface conformance and provider-factory tests."""

import pytest

from app.market.interface import MarketDataProvider
from app.market.massive import MassiveClient
from app.market.provider import create_provider
from app.market.simulator import Simulator


def test_simulator_implements_provider_interface():
    sim = Simulator()
    assert isinstance(sim, MarketDataProvider)


def test_massive_client_implements_provider_interface(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "test-key")
    client = MassiveClient(tickers=["AAPL"])
    assert isinstance(client, MarketDataProvider)


def test_factory_returns_simulator_when_api_key_unset(monkeypatch):
    monkeypatch.delenv("MASSIVE_API_KEY", raising=False)
    provider = create_provider()
    assert isinstance(provider, Simulator)


def test_factory_returns_simulator_when_api_key_blank(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "   ")
    provider = create_provider()
    assert isinstance(provider, Simulator)


def test_factory_returns_massive_when_api_key_set(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "real-key")
    provider = create_provider()
    assert isinstance(provider, MassiveClient)


@pytest.mark.parametrize("method_name", ["start", "stop"])
def test_provider_methods_are_async_coroutines(method_name, monkeypatch):
    """Both providers expose async start/stop on the abstract contract."""
    import inspect

    sim = Simulator()
    assert inspect.iscoroutinefunction(getattr(sim, method_name))

    monkeypatch.setenv("MASSIVE_API_KEY", "test-key")
    massive = MassiveClient(tickers=["AAPL"])
    assert inspect.iscoroutinefunction(getattr(massive, method_name))


def test_provider_interface_cannot_be_instantiated_directly():
    """Abstract base must enforce subclass implementation."""
    with pytest.raises(TypeError):
        MarketDataProvider()  # type: ignore[abstract]
