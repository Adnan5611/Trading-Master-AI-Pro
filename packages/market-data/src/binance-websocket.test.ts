import { describe, expect, it, vi } from "vitest";
import {
  BINANCE_USDM_MARKET_WS_URL,
  BinanceWebSocketClient,
  type BinanceWebSocketLike,
  type BinanceWebSocketOptions
} from "./binance-websocket.js";

class FakeSocket implements BinanceWebSocketLike {
  readonly readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  closed = false;

  open(): void {
    this.onopen?.({});
  }

  emit(payload: unknown): void {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(payload) }));
  }

  close(): void {
    this.closed = true;
    this.onclose?.({});
  }
}

const btcEvent = {
  e: "kline",
  E: 1_700_000_060_000,
  s: "BTCUSDT",
  k: {
    t: 1_700_000_000_000,
    T: 1_700_000_059_999,
    s: "BTCUSDT",
    i: "1m",
    o: "100",
    h: "110",
    l: "95",
    c: "105",
    v: "12.5",
    n: 42,
    V: "7.5",
    x: false
  }
};

const xauEvent = {
  e: "continuous_kline",
  E: 1_700_000_060_000,
  ps: "XAUUSDT",
  ct: "TRADIFI_PERPETUAL",
  k: {
    t: 1_700_000_000_000,
    T: 1_700_000_059_999,
    i: "1m",
    o: "2000",
    h: "2010",
    l: "1995",
    c: "2005",
    v: "22.5",
    n: 32,
    V: "12.5",
    x: true
  }
};

function makeClient(overrides: Partial<BinanceWebSocketOptions> = {}) {
  const socket = new FakeSocket();
  const socketFactory = vi.fn(() => socket);
  const client = new BinanceWebSocketClient({
    timeframes: ["1m"],
    socketFactory,
    now: () => 1_700_000_060_100,
    ...overrides
  });
  return { client, socket, socketFactory };
}

describe("BinanceWebSocketClient", () => {
  it("routes BTC and XAU through their correct contract-specific streams", () => {
    const { client } = makeClient();
    expect(client.getStreamNames()).toEqual([
      "btcusdt@kline_1m",
      "xauusdt_tradifi_perpetual@continuousKline_1m",
      "tradingSession"
    ]);
    expect(client.getConnectionUrl()).toContain(BINANCE_USDM_MARKET_WS_URL);
    expect(decodeURIComponent(client.getConnectionUrl())).toContain("xauusdt_tradifi_perpetual@continuousKline_1m");
  });

  it("normalizes a BTC symbol-kline event and preserves forming-candle state", () => {
    const onCandle = vi.fn();
    const { client, socket } = makeClient({ onCandle });
    client.start();
    socket.open();
    socket.emit({ stream: "btcusdt@kline_1m", data: btcEvent });

    expect(onCandle).toHaveBeenCalledWith(expect.objectContaining({
      instrument: "BTCUSDT",
      timeframe: "1m",
      close: 105,
      isClosed: false,
      source: "binance-usdm-websocket"
    }));
    expect(client.getHealth().instruments.BTCUSDT.feedStatus).toBe("LIVE");
  });

  it("normalizes XAU continuous-kline events only for TRADIFI_PERPETUAL", () => {
    const onCandle = vi.fn();
    const { client, socket } = makeClient({ onCandle });
    client.start();
    socket.open();
    socket.emit(xauEvent);
    expect(onCandle).toHaveBeenCalledWith(expect.objectContaining({
      instrument: "XAUUSDT",
      close: 2005,
      isClosed: true,
      source: "binance-usdm-websocket"
    }));
  });

  it("rejects a wrong XAU contract type rather than substituting another stream", () => {
    const onError = vi.fn();
    const onCandle = vi.fn();
    const { client, socket } = makeClient({ onError, onCandle });
    client.start();
    socket.open();
    socket.emit({ ...xauEvent, ct: "PERPETUAL" });
    expect(onCandle).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: /contract mismatch/ }));
  });

  it("rejects malformed OHLC values", () => {
    const onError = vi.fn();
    const { client, socket } = makeClient({ onError });
    client.start();
    socket.open();
    socket.emit({ ...btcEvent, k: { ...btcEvent.k, h: "90" } });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: /OHLC/ }));
  });

  it("reports commodity trading-session updates", () => {
    const onSession = vi.fn();
    const { client, socket } = makeClient({ onSession });
    client.start();
    socket.open();
    socket.emit({
      e: "CommodityUpdate",
      E: 1_700_000_060_000,
      t: 1_700_000_000_000,
      T: 1_700_003_600_000,
      S: "REGULAR"
    });
    expect(onSession).toHaveBeenCalledWith(expect.objectContaining({
      type: "REGULAR",
      startTime: 1_700_000_000_000,
      endTime: 1_700_003_600_000
    }));
  });

  it("does not let a commodity session message mask missing XAU price candles", () => {
    const { client, socket } = makeClient();
    client.start();
    socket.open();
    socket.emit({
      e: "CommodityUpdate",
      E: 1_700_000_060_000,
      t: 1_700_000_000_000,
      T: 1_700_003_600_000,
      S: "NO_TRADING"
    });
    expect(client.getHealth().instruments.XAUUSDT.feedStatus).toBe("SESSION_CLOSED");
    expect(client.getHealth().instruments.BTCUSDT.feedStatus).toBe("WAITING");
  });

  it("marks a feed stale when no valid market event arrives within the threshold", () => {
    let now = 1_700_000_060_100;
    const { client, socket } = makeClient({
      now: () => now,
      staleAfterMs: 2_000
    });
    client.start();
    socket.open();
    socket.emit(btcEvent);
    expect(client.getHealth().instruments.BTCUSDT.feedStatus).toBe("LIVE");
    now += 2_001;
    expect(client.getHealth().instruments.BTCUSDT.feedStatus).toBe("STALE");
  });

  it("reports connection state and closes the socket on stop", () => {
    const { client, socket } = makeClient();
    client.start();
    expect(client.getHealth().feedStatus).toBe("CONNECTING");
    socket.open();
    expect(client.getHealth().feedStatus).toBe("WAITING");
    client.stop();
    expect(socket.closed).toBe(true);
    expect(client.getHealth().feedStatus).toBe("OFFLINE");
  });

  it("rejects duplicate and unsupported timeframes", () => {
    expect(() => makeClient({ timeframes: ["1m", "1m"] })).toThrow(/Duplicate/);
    expect(() => makeClient({ timeframes: ["3m" as never] })).toThrow(/subset/);
  });
});
