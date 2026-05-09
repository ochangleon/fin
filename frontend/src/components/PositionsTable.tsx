"use client";

import { useState, useMemo } from "react";
import type { Position } from "@/lib/api";
import type { PriceMap } from "@/hooks/useMarketData";

interface PositionsTableProps {
  positions: Position[];
  prices: PriceMap;
}

interface Row {
  ticker: string;
  quantity: number;
  avgCost: number;
  price: number;
  pnl: number;
  pnlPct: number;
}

type SortKey = keyof Row;
type SortDir = "asc" | "desc";

function compare(a: Row, b: Row, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv);
  return (av as number) - (bv as number);
}

export default function PositionsTable({ positions, prices }: PositionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const rows: Row[] = useMemo(
    () =>
      positions.map((pos) => {
        const price = prices[pos.ticker]?.price ?? pos.current_price;
        const pnl = (price - pos.avg_cost) * pos.quantity;
        const pnlPct =
          pos.avg_cost > 0 ? ((price - pos.avg_cost) / pos.avg_cost) * 100 : 0;
        return {
          ticker: pos.ticker,
          quantity: pos.quantity,
          avgCost: pos.avg_cost,
          price,
          pnl,
          pnlPct,
        };
      }),
    [positions, prices],
  );

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const cmp = compare(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "ticker" ? "asc" : "desc");
    }
  }

  if (positions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-secondary">
        No positions
      </div>
    );
  }

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const headerCell = (key: SortKey, label: string, align: "left" | "right") => (
    <th
      onClick={() => handleSort(key)}
      className={`cursor-pointer select-none pb-1 pr-2 ${align === "right" ? "text-right" : "text-left"} hover:text-text-primary`}
    >
      {label}
      {arrow(key)}
    </th>
  );

  return (
    <div className="overflow-auto text-xs">
      <table className="w-full">
        <thead>
          <tr className="text-text-secondary">
            {headerCell("ticker", "Ticker", "left")}
            {headerCell("quantity", "Qty", "right")}
            {headerCell("avgCost", "Avg", "right")}
            {headerCell("price", "Price", "right")}
            {headerCell("pnl", "P&L", "right")}
            {headerCell("pnlPct", "%", "right")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const color = row.pnl >= 0 ? "text-green" : "text-red";
            return (
              <tr key={row.ticker} className="border-t border-border">
                <td className="py-1 pr-2 font-semibold text-accent-yellow">{row.ticker}</td>
                <td className="py-1 pr-2 text-right">{row.quantity}</td>
                <td className="py-1 pr-2 text-right">${row.avgCost.toFixed(2)}</td>
                <td className="py-1 pr-2 text-right">${row.price.toFixed(2)}</td>
                <td className={`py-1 pr-2 text-right ${color}`}>
                  {row.pnl >= 0 ? "+" : "-"}${Math.abs(row.pnl).toFixed(2)}
                </td>
                <td className={`py-1 text-right ${color}`}>
                  {row.pnlPct >= 0 ? "+" : ""}{row.pnlPct.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
