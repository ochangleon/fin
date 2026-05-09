import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PositionsTable from "@/components/PositionsTable";
import type { Position } from "@/lib/api";

const positions: Position[] = [
  {
    ticker: "AAPL",
    quantity: 10,
    avg_cost: 100,
    current_price: 110,
    unrealized_pnl: 100,
    pnl_percent: 10,
  },
  {
    ticker: "GOOGL",
    quantity: 5,
    avg_cost: 200,
    current_price: 180,
    unrealized_pnl: -100,
    pnl_percent: -10,
  },
  {
    ticker: "MSFT",
    quantity: 2,
    avg_cost: 300,
    current_price: 330,
    unrealized_pnl: 60,
    pnl_percent: 10,
  },
];

function tickerOrder(): string[] {
  const rows = screen.getAllByRole("row").slice(1); // skip header
  return rows.map((r) => within(r).getAllByRole("cell")[0].textContent ?? "");
}

describe("PositionsTable", () => {
  it("renders all positions with computed P&L", () => {
    render(<PositionsTable positions={positions} prices={{}} />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("GOOGL")).toBeInTheDocument();
    expect(screen.getByText("MSFT")).toBeInTheDocument();
    // AAPL: (110-100)*10 = +$100
    expect(screen.getByText("+$100.00")).toBeInTheDocument();
    // GOOGL: (180-200)*5 = -$100
    expect(screen.getByText("-$100.00")).toBeInTheDocument();
    // MSFT: (330-300)*2 = +$60
    expect(screen.getByText("+$60.00")).toBeInTheDocument();
  });

  it("uses live prices when provided", () => {
    const prices = {
      AAPL: {
        ticker: "AAPL",
        price: 120,
        previous_price: 110,
        timestamp: "",
        direction: "up" as const,
      },
    };
    render(<PositionsTable positions={[positions[0]]} prices={prices} />);
    // (120-100)*10 = +$200
    expect(screen.getByText("+$200.00")).toBeInTheDocument();
  });

  it("sorts by ticker ascending by default", () => {
    render(<PositionsTable positions={positions} prices={{}} />);
    expect(tickerOrder()).toEqual(["AAPL", "GOOGL", "MSFT"]);
  });

  it("toggles sort direction when clicking the same header", () => {
    render(<PositionsTable positions={positions} prices={{}} />);
    fireEvent.click(screen.getByText(/Ticker/));
    expect(tickerOrder()).toEqual(["MSFT", "GOOGL", "AAPL"]);
  });

  it("sorts by P&L descending when P&L header clicked", () => {
    render(<PositionsTable positions={positions} prices={{}} />);
    fireEvent.click(screen.getByText(/P&L/));
    // +100, +60, -100
    expect(tickerOrder()).toEqual(["AAPL", "MSFT", "GOOGL"]);
  });

  it("sorts by quantity", () => {
    render(<PositionsTable positions={positions} prices={{}} />);
    fireEvent.click(screen.getByText(/Qty/));
    // descending: 10, 5, 2
    expect(tickerOrder()).toEqual(["AAPL", "GOOGL", "MSFT"]);
    fireEvent.click(screen.getByText(/Qty/));
    // ascending: 2, 5, 10
    expect(tickerOrder()).toEqual(["MSFT", "GOOGL", "AAPL"]);
  });

  it("renders empty state when no positions", () => {
    render(<PositionsTable positions={[]} prices={{}} />);
    expect(screen.getByText("No positions")).toBeInTheDocument();
  });
});
