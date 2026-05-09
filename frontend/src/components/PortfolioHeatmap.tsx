"use client";

import { Treemap, ResponsiveContainer } from "recharts";
import type { Position } from "@/lib/api";
import type { PriceMap } from "@/hooks/useMarketData";

interface PortfolioHeatmapProps {
  positions: Position[];
  prices: PriceMap;
}

interface HeatmapDatum {
  name: string;
  size: number;
  pnlPct: number;
  [key: string]: unknown;
}

function pnlColor(pnlPct: number): string {
  const intensity = Math.min(Math.abs(pnlPct) / 5, 1);
  const alpha = 0.2 + intensity * 0.6;
  return pnlPct >= 0
    ? `rgba(63, 185, 80, ${alpha})`
    : `rgba(248, 81, 73, ${alpha})`;
}

interface TileProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  pnlPct?: number;
}

function Tile(props: TileProps) {
  const { x = 0, y = 0, width = 0, height = 0, name, pnlPct } = props;
  if (width <= 0 || height <= 0) return null;
  const showLabel = width > 36 && height > 18;
  const showPnl = width > 50 && height > 28;
  const fill = typeof pnlPct === "number" ? pnlColor(pnlPct) : "rgba(48,54,61,0.4)";
  const sign = pnlPct !== undefined && pnlPct >= 0 ? "+" : "";
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#0d1117"
        strokeWidth={1}
      />
      {showLabel && name && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showPnl ? 6 : 0)}
          textAnchor="middle"
          fill="#f0f6fc"
          fontSize={11}
          fontWeight={600}
        >
          {name}
        </text>
      )}
      {showPnl && pnlPct !== undefined && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 8}
          textAnchor="middle"
          fill={pnlPct >= 0 ? "#3fb950" : "#f85149"}
          fontSize={9}
        >
          {sign}{pnlPct.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

export default function PortfolioHeatmap({ positions, prices }: PortfolioHeatmapProps) {
  if (positions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-secondary">
        No positions
      </div>
    );
  }

  const data: HeatmapDatum[] = positions
    .map((pos) => {
      const livePrice = prices[pos.ticker]?.price ?? pos.current_price;
      const value = Math.abs(livePrice * pos.quantity);
      const pnlPct =
        pos.avg_cost > 0 ? ((livePrice - pos.avg_cost) / pos.avg_cost) * 100 : 0;
      return { name: pos.ticker, size: value, pnlPct };
    })
    .filter((d) => d.size > 0);

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={data}
        dataKey="size"
        nameKey="name"
        stroke="#0d1117"
        isAnimationActive={false}
        content={<Tile />}
      />
    </ResponsiveContainer>
  );
}
