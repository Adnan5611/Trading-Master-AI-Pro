/**
 * Public Binance USDⓈ-M REST market-data adapter.
 *
 * No API key is used. This module does not place orders.
 * Product identity must still be checked independently for every instrument;
 * callers must not assume a successful HTTP response proves a product is the
 * intended contract. XAUUSDT remains gated on explicit product metadata checks.
 */

export const BINANCE_USDM_REST_BASE_URL = "https://fapi.binance.com";

export const MARKET_INSTRUMENTS = ["BTCUSDT", "XAUUSDT"] as const;
export type MarketInstrument = (typeof MARKET_INSTRUMENTS)[number];

export const MARKET_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"] as const;
export type MarketTimeframe = (typeof MARKET_TIMEFRAMES)[number];

export interface NormalizedCandle {
  readonly instrument: MarketInstrument;
  readonly timeframe: MarketTimeframe;
  readonly openTime: number;
  readonly closeTime: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly isClosed: boolean;
  readonly tradeCount: number;
  readonly takerBuyBaseVolume: number;
  readonly source: "binance-usdm-rest";
  readonly receivedAt: number;
}

export interface BinanceRestOptions {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
  readonly timeoutMs?: number;
  readonly now?: () => number;
}

export interface BinancePrice {
  readonly instrument: MarketInstrument;
  readonly price: number;
  readonly source: "binance-usdm-rest";
  readonly receivedAt: number;
}

export interface BinanceSymbolMetadata {
  readonly symbol: string;
  readonly status?: string;
  readonly contractType?: string;
  readonly quoteAsset?: string;
  readonly marginAsset?: string;
  readonly onboardDate?: number;
  readonly deliveryDate?: number;
  readonly filters?: readonly unknown[];
}

interface ExchangeInfoResponse {
  readonly symbols?: readonly BinanceSymbolMetadata[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`Invalid Binance field: ${field}`);
  return parsed;
}

function assertInstrument(value: string): asserts value is MarketInstrument {
  if (!(MARKET_INSTRUMENTS as readonly string[]).includes(value)) {
    throw new TypeError(`Unsupported instrument: ${value}`);
  }
}

function assertTimeframe(value: string): asserts value is MarketTimeframe {
  if (!(MARKET_TIMEFRAMES as readonly string[]).includes(value)) {
    throw new TypeError(`Unsupported timeframe: ${value}`);
  }
}

function parseKline(
  raw: unknown,
  instrument: MarketInstrument,
  timeframe: MarketTimeframe,
  receivedAt: number
): NormalizedCandle {
  if (!Array.isArray(raw) || raw.length < 11) {
    throw new TypeError("Malformed Binance kline: expected at least 11 fields");
  }

  const openTime = finiteNumber(raw[0], "openTime");
  const open = finiteNumber(raw[1], "open");
  const high = finiteNumber(raw[2], "high");
  const low = finiteNumber(raw[3], "low");
  const close = finiteNumber(raw[4], "close");
  const volume = finiteNumber(raw[5], "volume");
  const closeTime = finiteNumber(raw[6], "closeTime");
  const tradeCount = finiteNumber(raw[8], "tradeCount");
  const takerBuyBaseVolume = finiteNumber(raw[9], "takerBuyBaseVolume");

  if (!Number.isSafeInteger(openTime) || !Number.isSafeInteger(closeTime) || closeTime < openTime) {
    throw new RangeError("Invalid Binance kline timestamps");
  }
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0 || tradeCount < 0 || takerBuyBaseVolume < 0) {
    throw new RangeError("Binance kline contains a non-positive price or negative volume/count");
  }
  if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
    throw new RangeError("Binance kline violates OHLC price relationships");
  }

  return Object.freeze({
    instrument,
    timeframe,
    openTime,
    closeTime,
    open,
    high,
    low,
    close,
    volume,
    isClosed: closeTime < receivedAt,
    tradeCount,
    takerBuyBaseVolume,
    source: "binance-usdm-rest",
    receivedAt
  });
}

export class BinanceRestClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(options: BinanceRestOptions = {}) {
    this.baseUrl = (options.baseUrl ?? BINANCE_USDM_REST_BASE_URL).replace(/\/$/, "");
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.now = options.now ?? Date.now;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1) {
      throw new RangeError("timeoutMs must be a positive safe integer");
    }
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const response = await this.fetcher(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`Binance REST request failed: HTTP ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  }

  async getPrice(instrument: MarketInstrument): Promise<BinancePrice> {
    assertInstrument(instrument);
    const payload = await this.get<unknown>("/fapi/v1/ticker/price", { symbol: instrument });
    if (!isRecord(payload) || payload.symbol !== instrument) {
      throw new TypeError("Binance ticker response symbol mismatch");
    }
    return Object.freeze({
      instrument,
      price: finiteNumber(payload.price, "price"),
      source: "binance-usdm-rest",
      receivedAt: this.now()
    });
  }

  async getKlines(
    instrument: MarketInstrument,
    timeframe: MarketTimeframe,
    limit = 500
  ): Promise<readonly NormalizedCandle[]> {
    assertInstrument(instrument);
    assertTimeframe(timeframe);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1500) {
      throw new RangeError("Kline limit must be an integer from 1 to 1500");
    }

    const payload = await this.get<unknown>("/fapi/v1/klines", {
      symbol: instrument,
      interval: timeframe,
      limit: String(limit)
    });
    if (!Array.isArray(payload)) throw new TypeError("Malformed Binance klines response");

    const receivedAt = this.now();
    const candles = payload.map((row) => parseKline(row, instrument, timeframe, receivedAt));
    const seen = new Set<number>();
    for (const candle of candles) {
      if (seen.has(candle.openTime)) throw new Error("Duplicate candle openTime in Binance response");
      seen.add(candle.openTime);
    }
    for (let index = 1; index < candles.length; index += 1) {
      if (candles[index]!.openTime <= candles[index - 1]!.openTime) {
        throw new Error("Binance candles are not in ascending openTime order");
      }
    }
    return Object.freeze(candles);
  }

  async getSymbolMetadata(instrument: MarketInstrument): Promise<BinanceSymbolMetadata> {
    assertInstrument(instrument);
    const payload = await this.get<ExchangeInfoResponse>("/fapi/v1/exchangeInfo", {});
    const metadata = payload.symbols?.find((item) => item.symbol === instrument);
    if (!metadata) throw new Error(`Instrument ${instrument} is not listed by this Binance product endpoint`);
    return Object.freeze({ ...metadata });
  }
}
