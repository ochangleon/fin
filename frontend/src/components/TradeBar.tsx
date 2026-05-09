"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface TradeBarProps {
  onTradeExecuted: () => void;
  selectedTicker?: string | null;
}

const SUBMIT_PURPLE = "#753991";

export default function TradeBar({ onTradeExecuted, selectedTicker }: TradeBarProps) {
  // userTicker = null means "not yet typed; mirror selectedTicker".
  const [userTicker, setUserTicker] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ticker = userTicker ?? selectedTicker ?? "";

  async function executeTrade(side: "buy" | "sell") {
    const qty = parseInt(quantity, 10);
    if (!ticker.trim() || isNaN(qty) || qty <= 0) return;

    setError(null);
    try {
      const result = await api.trade({
        ticker: ticker.trim().toUpperCase(),
        quantity: qty,
        side,
      });
      setStatus(`${result.side.toUpperCase()} ${result.quantity} ${result.ticker} @ $${result.price.toFixed(2)}`);
      setUserTicker("");
      setQuantity("");
      onTradeExecuted();
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : "Trade failed"}`);
    }
  }

  return (
    <div className="flex h-full items-center gap-3 text-xs">
      <input
        type="text"
        placeholder="Ticker"
        value={ticker}
        onChange={(e) => setUserTicker(e.target.value)}
        className="w-24 rounded border border-border bg-bg-secondary px-2 py-1 text-text-primary outline-none focus:border-accent-blue"
      />
      <input
        type="number"
        placeholder="Qty"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        min="1"
        className="w-20 rounded border border-border bg-bg-secondary px-2 py-1 text-text-primary outline-none focus:border-accent-blue"
      />
      <button
        onClick={() => executeTrade("buy")}
        style={{ backgroundColor: SUBMIT_PURPLE }}
        className="rounded px-3 py-1 font-semibold text-text-primary hover:brightness-110"
      >
        BUY
      </button>
      <button
        onClick={() => executeTrade("sell")}
        style={{ backgroundColor: SUBMIT_PURPLE }}
        className="rounded px-3 py-1 font-semibold text-text-primary hover:brightness-110"
      >
        SELL
      </button>
      {status && <span className="text-text-secondary">{status}</span>}
      {error && <span className="text-red">{error}</span>}
    </div>
  );
}
