import { describe, expect, it, vi } from "vitest";
import { BinanceRestClient } from "./binance-rest.js";

const kline = [
  1_700_000_000_000, "100", "110", "95", "105", "12.5",
  1_700_000_059_999, "1300", 42, "7.5", "800", "0"
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("BinanceRestClient", () => {
  it("requests a ticker for the exact requested instrument", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ symbol: "BTCUSDT", price: "102345.67" })
    );
    const client = new BinanceRestClient({ fetcher, now: () => 1_700_000_000_000 });

    await expect(client.getPrice("BTCUSDT")).resolves.toEqual({
      instrument: "BTCUSDT",
      price: 102345.67,
      source: "binance-usdm-rest",
      receivedAt: 1_700_000_000_000
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("symbol=BTCUSDT");
  });

  it("normalizes a valid kline and retains taker-buy volume", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([kline]));
    const client = new BinanceRestClient({ fetcher, now: () => 1_700_000_060_000 });
    const candles = await client.getKlines("XAUUSDT", "1m", 1);

    expect(candles).toHaveLength(1);
    expect(candles[0]).toMatchObject({
      instrument: "XAUUSDT",
      timeframe: "1m",
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 12.5,
      isClosed: true,
      tradeCount: 42,
      takerBuyBaseVolume: 7.5
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("symbol=XAUUSDT");
  });

  it("rejects unsupported intervals and invalid limits before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new BinanceRestClient({ fetcher });
    await expect(client.getKlines("BTCUSDT", "3m" as never)).rejects.toThrow("Unsupported timeframe");
    await expect(client.getKlines("BTCUSDT", "1m", 1501)).rejects.toThrow("limit");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects malformed OHLC data", async () => {
    const malformed = [...kline];
    malformed[2] = "90";
    const client = new BinanceRestClient({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([malformed]))
    });
    await expect(client.getKlines("BTCUSDT", "1m", 1)).rejects.toThrow("OHLC");
  });

  it("rejects HTTP errors instead of returning fake data", async () => {
    const client = new BinanceRestClient({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ code: -1003 }, 429))
    });
    await expect(client.getPrice("BTCUSDT")).rejects.toThrow("HTTP 429");
  });

  it("rejects duplicate candles", async () => {
    const client = new BinanceRestClient({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([kline, kline]))
    });
    await expect(client.getKlines("BTCUSDT", "1m", 2)).rejects.toThrow("Duplicate");
  });
  it("loads and validates the commodity trading schedule for TradFi products", async () => {
    const schedule = {
      updateTime: 1_700_000_000_000,
      marketSchedules: {
        COMMODITY: {
          sessions: [
            { startTime: 1_700_000_000_000, endTime: 1_700_003_600_000, type: "REGULAR" },
            { startTime: 1_700_003_600_000, endTime: 1_700_010_800_000, type: "NO_TRADING" }
          ]
        }
      }
    };
    const client = new BinanceRestClient({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(schedule))
    });
    await expect(client.getTradingSchedule()).resolves.toMatchObject({
      updateTime: 1_700_000_000_000,
      commoditySessions: [
        { type: "REGULAR" },
        { type: "NO_TRADING" }
      ]
    });
  });

  it("rejects malformed commodity trading schedules", async () => {
    const client = new BinanceRestClient({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
        updateTime: 1_700_000_000_000,
        marketSchedules: { COMMODITY: { sessions: [{ startTime: 10, endTime: 5, type: "REGULAR" }] } }
      }))
    });
    await expect(client.getTradingSchedule()).rejects.toThrow("Invalid commodity trading session");
  });

});
