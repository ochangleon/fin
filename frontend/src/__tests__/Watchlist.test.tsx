import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Watchlist from "@/components/Watchlist";

// Mock recharts to avoid canvas rendering issues
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
  LineChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Line: () => null,
}));

// Mock api
vi.mock("@/lib/api", () => ({
  api: {
    getWatchlist: vi.fn().mockResolvedValue([]),
    addTicker: vi.fn().mockResolvedValue({ ticker: "TEST" }),
    removeTicker: vi.fn().mockResolvedValue(undefined),
  },
  apiFetch: vi.fn(),
}));

import { api } from "@/lib/api";

const basePrices = {
  AAPL: {
    ticker: "AAPL",
    price: 150.25,
    previous_price: 149.0,
    timestamp: "2026-01-01T00:00:00Z",
    direction: "up" as const,
  },
};

describe("Watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getWatchlist).mockResolvedValue([]);
  });

  it("renders add ticker input", () => {
    render(
      <Watchlist
        prices={{}}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText("Add ticker")).toBeInTheDocument();
  });

  it("renders the add button", () => {
    const { container } = render(
      <Watchlist
        prices={{}}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={vi.fn()}
      />
    );
    const btn = within(container).getByRole("button", { name: "+" });
    expect(btn).toBeInTheDocument();
  });

  it("renders price data when available", async () => {
    vi.mocked(api.getWatchlist).mockResolvedValue([{ ticker: "AAPL" }]);

    render(
      <Watchlist
        prices={basePrices}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={vi.fn()}
      />
    );

    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("150.25")).toBeInTheDocument();
  });

  it("adds a ticker via input", async () => {
    const { container } = render(
      <Watchlist
        prices={{}}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Add ticker");
    fireEvent.change(input, { target: { value: "tsla" } });
    // Wait for React to re-render with updated state before clicking
    await waitFor(() => expect(input).toHaveValue("tsla"));
    const addBtn = within(container).getByRole("button", { name: "+" });
    fireEvent.click(addBtn);

    expect(await screen.findByText("TSLA")).toBeInTheDocument();
    expect(api.addTicker).toHaveBeenCalledWith("TSLA");
  });

  it("calls onSelectTicker when clicking a row", async () => {
    vi.mocked(api.getWatchlist).mockResolvedValue([{ ticker: "AAPL" }]);
    const onSelect = vi.fn();

    render(
      <Watchlist
        prices={basePrices}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={onSelect}
      />
    );

    const row = await screen.findByText("AAPL");
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith("AAPL");
  });

  it("renders table column headers", () => {
    const { container } = render(
      <Watchlist
        prices={{}}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={vi.fn()}
      />
    );
    const thead = container.querySelector("thead")!;
    expect(within(thead).getByText("Ticker")).toBeInTheDocument();
    expect(within(thead).getByText("Price")).toBeInTheDocument();
    expect(within(thead).getByText("Chg%")).toBeInTheDocument();
  });

  it("removes a ticker via the row remove button", async () => {
    vi.mocked(api.getWatchlist).mockResolvedValue([{ ticker: "AAPL" }]);

    render(
      <Watchlist
        prices={basePrices}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={vi.fn()}
      />
    );

    expect(await screen.findByText("AAPL")).toBeInTheDocument();

    const removeBtn = screen.getByTitle("Remove");
    fireEvent.click(removeBtn);

    await waitFor(() =>
      expect(screen.queryByText("AAPL")).not.toBeInTheDocument()
    );
    expect(api.removeTicker).toHaveBeenCalledWith("AAPL");
  });

  it("does not trigger row selection when clicking remove", async () => {
    vi.mocked(api.getWatchlist).mockResolvedValue([{ ticker: "AAPL" }]);
    const onSelect = vi.fn();

    render(
      <Watchlist
        prices={basePrices}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={onSelect}
      />
    );

    await screen.findByText("AAPL");
    const removeBtn = screen.getByTitle("Remove");
    fireEvent.click(removeBtn);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("applies flash-up class when price direction is up", async () => {
    vi.mocked(api.getWatchlist).mockResolvedValue([{ ticker: "AAPL" }]);

    const flatPrices = {
      AAPL: { ...basePrices.AAPL, direction: "flat" as const },
    };

    const { rerender, container } = render(
      <Watchlist
        prices={flatPrices}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={vi.fn()}
      />
    );

    await screen.findByText("AAPL");
    const row = container.querySelector("tbody tr")!;
    expect(row.classList.contains("flash-up")).toBe(false);

    rerender(
      <Watchlist
        prices={{
          AAPL: {
            ...basePrices.AAPL,
            price: 151,
            previous_price: 150.25,
            direction: "up",
          },
        }}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={vi.fn()}
      />
    );

    await waitFor(() => expect(row.classList.contains("flash-up")).toBe(true));
  });

  it("applies flash-down class when price direction is down", async () => {
    vi.mocked(api.getWatchlist).mockResolvedValue([{ ticker: "AAPL" }]);

    const flatPrices = {
      AAPL: { ...basePrices.AAPL, direction: "flat" as const },
    };

    const { rerender, container } = render(
      <Watchlist
        prices={flatPrices}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={vi.fn()}
      />
    );

    await screen.findByText("AAPL");
    const row = container.querySelector("tbody tr")!;

    rerender(
      <Watchlist
        prices={{
          AAPL: {
            ...basePrices.AAPL,
            price: 149,
            previous_price: 150.25,
            direction: "down",
          },
        }}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(row.classList.contains("flash-down")).toBe(true)
    );
  });

  it("toggles flash class from up to down when direction changes", async () => {
    vi.mocked(api.getWatchlist).mockResolvedValue([{ ticker: "AAPL" }]);

    const { rerender, container } = render(
      <Watchlist
        prices={{
          AAPL: { ...basePrices.AAPL, direction: "up" },
        }}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={vi.fn()}
      />
    );

    await screen.findByText("AAPL");
    const row = container.querySelector("tbody tr")!;
    await waitFor(() => expect(row.classList.contains("flash-up")).toBe(true));

    rerender(
      <Watchlist
        prices={{
          AAPL: {
            ...basePrices.AAPL,
            price: 148,
            previous_price: 150.25,
            direction: "down",
          },
        }}
        priceHistory={{}}
        selectedTicker={null}
        onSelectTicker={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(row.classList.contains("flash-down")).toBe(true);
      expect(row.classList.contains("flash-up")).toBe(false);
    });
  });
});
