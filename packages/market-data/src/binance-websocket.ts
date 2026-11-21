/**
 * Public Binance USDⓈ-M market-stream adapter.
 *
 * Uses public market data only. It never authenticates or places orders.
 * BTCUSDT uses symbol klines; XAUUSDT uses the explicitly verified
 * TRADIFI_PERPETUAL continuous-kline stream.
 */

import {
  MARKET_TIMEFRAMES,
  type MarketInstrument,
  type MarketTimeframe,
  type NormalizedCandle
} from "./binance-rest.js";

export const BINANCE_USDM_MARKET_WS_URL =
  "wss://fstream.binance.com/market/stream";

export type BinanceWebSocketState = "idle" | "connecting" | "open" | "closed" | "error";

export interface BinanceCommoditySession {
  readonly startTime: number;
  readonly endTime: number;
  readonly type: "REGULAR" | "NO_TRADING";
  readonly eventTime: number;
  readonly receivedAt: number;
}

export interface BinanceWebSocketHealth {
  readonly state: BinanceWebSocketState;
  readonly feedStatus: "OFFLINE" | "CONNECTING" | "LIVE" | "STALE" | "ERROR";
  readonly lastEventAt: number | null;
  readonly staleAfterMs: number;
}

export interface BinanceWebSocketLike {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: Event) => void) | null;
  close(code?: number, reason?: string): void;
}

export interface BinanceWebSocketOptions {
  readonly baseUrl?: string;
  readonly timeframes?: readonly MarketTimeframe[];
  readonly staleAfterMs?: number;
  readonly now?: () => number;
  readonly socketFactory?: (url: string) => BinanceWebSocketLike;
  readonly onCandle?: (candle: NormalizedCandle) => void;
  readonly onSession?: (session: BinanceCommoditySession) => void;
  readonly onState?: (health: BinanceWebSocketHealth) => void;
  readonly onError?: (error: Error) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNumber(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`Invalid Binance WebSocket field: ${field}`);
  return parsed;
}

function assertTimeframe(value: string): asserts value is MarketTimeframe {
  if (!(MARKET_TIMEFRAMES as readonly string[]).includes(value)) {
    throw new TypeError(`Unsupported Binance WebSocket timeframe: ${value}`);
  }
}

function defaultSocketFactory(url: string): BinanceWebSocketLike {
  const runtime = globalThis as typeof globalThis & {
    WebSocket?: new (url: string) => BinanceWebSocketLike;
  };
  if (!runtime.WebSocket) {
    throw new Error("This runtime does not provide WebSocket; inject a socketFactory");
  }
  return new runtime.WebSocket(url);
}

function parseCandle(
  event: Record<string, unknown>,
  receivedAt: number
): NormalizedCandle {
  const kind = event.e;
  const instrument: MarketInstrument = kind === "kline" ? "BTCUSDT" : "XAUUSDT";
  const candle = event.k;
  if (!isRecord(candle)) throw new TypeError("Binance WebSocket event is missing kline data");

  if (kind === "kline") {
    if (event.s !== instrument || candle.s !== instrument) {
      throw new Error("BTCUSDT WebSocket symbol mismatch");
    }
  } else if (kind === "continuous_kline") {
    if (event.ps !== instrument || event.ct !== "TRADIFI_PERPETUAL") {
      throw new Error("XAUUSDT WebSocket contract mismatch");
    }
  } else {
    throw new TypeError("Unsupported Binance WebSocket candle event");
  }

  if (typeof candle.i !== "string") throw new TypeError("Missing Binance kline interval");
  assertTimeframe(candle.i);
  const eventTime = parseNumber(event.E, "event.E");
  const openTime = parseNumber(candle.t, "k.t");
  const closeTime = parseNumber(candle.T, "k.T");
  const open = parseNumber(candle.o, "k.o");
  const high = parseNumber(candle.h, "k.h");
  const low = parseNumber(candle.l, "k.l");
  const close = parseNumber(candle.c, "k.c");
  const volume = parseNumber(candle.v, "k.v");
  const tradeCount = parseNumber(candle.n, "k.n");
  const takerBuyBaseVolume = parseNumber(candle.V, "k.V");

  if (!Number.isSafeInteger(eventTime) || !Number.isSafeInteger(openTime) || !Number.isSafeInteger(closeTime) || closeTime < openTime) {
    throw new RangeError("Invalid Binance WebSocket candle timestamps");
  }
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0 ||
      volume < 0 || tradeCount < 0 || takerBuyBaseVolume < 0) {
    throw new RangeError("Binance WebSocket candle has invalid price or volume values");
  }
  if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
    throw new RangeError("Binance WebSocket candle violates OHLC relationships");
  }
  if (typeof candle.x !== "boolean") {
    throw new TypeError("Binance WebSocket candle is missing its closed-state flag");
  }

  return Object.freeze({
    instrument,
    timeframe: candle.i,
    eventTime,
    openTime,
    closeTime,
    open,
    high,
    low,
    close,
    volume,
    isClosed: candle.x,
    tradeCount,
    takerBuyBaseVolume,
    source: "binance-usdm-websocket",
    receivedAt
  });
}

function parseCommoditySession(
  event: Record<string, unknown>,
  receivedAt: number
): BinanceCommoditySession {
  const startTime = parseNumber(event.t, "session.startTime");
  const endTime = parseNumber(event.T, "session.endTime");
  if (!Number.isSafeInteger(startTime) || !Number.isSafeInteger(endTime) || endTime <= startTime) {
    throw new RangeError("Invalid Binance commodity session timestamps");
  }
  if (event.S !== "REGULAR" && event.S !== "NO_TRADING") {
    throw new TypeError("Unknown Binance commodity session type");
  }
  return Object.freeze({
    startTime,
    endTime,
    type: event.S,
    eventTime: parseNumber(event.E, "session.eventTime"),
    receivedAt
  });
}

export class BinanceWebSocketClient {
  private readonly baseUrl: string;
  private readonly timeframes: readonly MarketTimeframe[];
  private readonly staleAfterMs: number;
  private readonly now: () => number;
  private readonly socketFactory: (url: string) => BinanceWebSocketLike;
  private readonly onCandle: ((candle: NormalizedCandle) => void) | undefined;
  private readonly onSession: ((session: BinanceCommoditySession) => void) | undefined;
  private readonly onState: ((health: BinanceWebSocketHealth) => void) | undefined;
  private readonly onError: ((error: Error) => void) | undefined;
  private socket: BinanceWebSocketLike | null = null;
  private state: BinanceWebSocketState = "idle";
  private lastEventAt: number | null = null;

  constructor(options: BinanceWebSocketOptions = {}) {
    this.baseUrl = options.baseUrl ?? BINANCE_USDM_MARKET_WS_URL;
    this.timeframes = Object.freeze([...(options.timeframes ?? MARKET_TIMEFRAMES)]);
    this.staleAfterMs = options.staleAfterMs ?? 5_000;
    this.now = options.now ?? Date.now;
    this.socketFactory = options.socketFactory ?? defaultSocketFactory;
    this.onCandle = options.onCandle;
    this.onSession = options.onSession;
    this.onState = options.onState;
    this.onError = options.onError;

    if (!Number.isSafeInteger(this.staleAfterMs) || this.staleAfterMs < 1) {
      throw new RangeError("staleAfterMs must be a positive safe integer");
    }
    if (this.timeframes.length === 0 ||
        this.timeframes.some((timeframe) => !(MARKET_TIMEFRAMES as readonly string[]).includes(timeframe))) {
      throw new TypeError("WebSocket timeframes must be a non-empty subset of configured market timeframes");
    }
    if (new Set(this.timeframes).size !== this.timeframes.length) {
      throw new TypeError("Duplicate WebSocket timeframes are not allowed");
    }
  }

  getStreamNames(): readonly string[] {
    const streams = this.timeframes.flatMap((timeframe) => [
      `btcusdt@kline_${timeframe}`,
      `xauusdt_tradifi_perpetual@continuousKline_${timeframe}`
    ]);
    streams.push("tradingSession");
    return Object.freeze(streams);
  }

  getConnectionUrl(): string {
    const url = new URL(this.baseUrl);
    url.searchParams.set("streams", this.getStreamNames().join("/"));
    return url.toString();
  }

  getHealth(): BinanceWebSocketHealth {
    const stale = this.state === "open" &&
      (this.lastEventAt === null || this.now() - this.lastEventAt > this.staleAfterMs);
    const feedStatus: BinanceWebSocketHealth["feedStatus"] =
      this.state === "open" ? (stale ? "STALE" : "LIVE") :
      this.state === "connecting" ? "CONNECTING" :
      this.state === "error" ? "ERROR" : "OFFLINE";
    return Object.freeze({
      state: this.state,
      feedStatus,
      lastEventAt: this.lastEventAt,
      staleAfterMs: this.staleAfterMs
    });
  }

  private publishState(): void {
    this.onState?.(this.getHealth());
  }

  private reportError(error: Error): void {
    this.onError?.(error);
  }

  private handleMessage(data: unknown): void {
    try {
      if (typeof data !== "string") {
        throw new TypeError("Expected Binance WebSocket message as JSON text");
      }
      const parsed: unknown = JSON.parse(data);
      const payload = isRecord(parsed) && "data" in parsed ? parsed.data : parsed;
      if (!isRecord(payload)) throw new TypeError("Malformed Binance WebSocket payload");

      const receivedAt = this.now();
      if (payload.e === "kline" || payload.e === "continuous_kline") {
        const candle = parseCandle(payload, receivedAt);
        this.lastEventAt = receivedAt;
        this.onCandle?.(candle);
        this.publishState();
        return;
      }
      if (payload.e === "CommodityUpdate") {
        const session = parseCommoditySession(payload, receivedAt);
        this.lastEventAt = receivedAt;
        this.onSession?.(session);
        this.publishState();
      }
      // Subscription acknowledgements and unrelated event types are ignored.
    } catch (error) {
      this.reportError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  start(): void {
    if (this.socket && (this.state === "connecting" || this.state === "open")) {
      throw new Error("Binance WebSocket client is already started");
    }
    this.state = "connecting";
    this.lastEventAt = null;
    this.publishState();

    try {
      const socket = this.socketFactory(this.getConnectionUrl());
      this.socket = socket;
      socket.onopen = () => {
        if (this.socket !== socket) return;
        this.state = "open";
        this.publishState();
      };
      socket.onmessage = (event) => {
        if (this.socket === socket) this.handleMessage(event.data);
      };
      socket.onerror = () => {
        if (this.socket !== socket) return;
        this.state = "error";
        this.publishState();
        this.reportError(new Error("Binance WebSocket transport error"));
      };
      socket.onclose = () => {
        if (this.socket !== socket) return;
        this.state = "closed";
        this.publishState();
      };
    } catch (error) {
      this.state = "error";
      this.publishState();
      this.reportError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  stop(): void {
    const socket = this.socket;
    this.socket = null;
    this.state = "closed";
    this.publishState();
    socket?.close(1000, "Client stopped");
  }
}
