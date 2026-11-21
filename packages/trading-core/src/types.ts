/**
 * Shared Trading Core contracts.
 *
 * These types are platform-agnostic: the backend, the Electron desktop app and
 * the React Native Android app all consume the same definitions. Nothing here
 * may import Express, Electron, React or any transport-layer package.
 */

/** Initial timeframe set from Blueprint §2.2. Exchange support is verified at runtime. */
export const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

/** Initial instruments from Blueprint §2.1. */
export const INSTRUMENT_IDS = ["BTCUSDT", "XAUUSDT"] as const;

export type InstrumentId = (typeof INSTRUMENT_IDS)[number];

/**
 * XAUUSDT is a Binance TradFi perpetual (USDT-settled) and is deliberately
 * modelled as a distinct market type from the USDⓈ-M futures contract.
 */
export type MarketType = "binance-usdm-futures" | "binance-tradfi-perpetual";

export type TradeDirection = "bullish" | "bearish";

export type DetectionDirection = TradeDirection | "neutral";

/** Blueprint §8 signal outcomes. */
export type SignalDirection = "BUY" | "SELL" | "WAIT" | "NO SIGNAL";

/**
 * Normalised OHLCV candle.
 *
 * `isClosed` distinguishes a finished candle from the currently forming one so
 * that structural analysis can never consume an unfinished candle
 * (Blueprint §9, anti-lookahead).
 */
export interface Candle {
  readonly instrument: InstrumentId;
  readonly timeframe: Timeframe;
  readonly openTime: number;
  readonly closeTime: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly isClosed: boolean;
}

/** Static instrument identity only — no invented exchange filters. */
export interface InstrumentConfig {
  readonly id: InstrumentId;
  readonly marketType: MarketType;
  readonly venue: "Binance";
  readonly quoteAsset: "USDT";
  /** Timeframes the platform is prepared to request; availability is verified per exchange metadata. */
  readonly candidateTimeframes: readonly Timeframe[];
}

/** Exchange-provided contract metadata (Phase 2 loads this; never hardcode it). */
export interface InstrumentMetadata {
  readonly instrument: InstrumentId;
  readonly tickSize: number;
  readonly quantityStepSize: number;
  readonly minQuantity?: number;
  readonly maxQuantity?: number;
  readonly pricePrecision?: number;
  readonly quantityPrecision?: number;
  readonly retrievedAt: number;
  readonly source: "exchange";
}

/** Event time of the underlying market data versus when this process received it. */
export interface DataTimestamp {
  readonly eventTime: number;
  readonly receivedAt: number;
}

export interface DetectionEvidence {
  readonly type: string;
  readonly description: string;
  readonly candleTimes?: readonly number[];
  readonly values?: Readonly<Record<string, number | string | boolean>>;
}

/**
 * Common detection result produced by every analysis engine.
 *
 * There is intentionally **no** confidence/probability/win-rate field: Blueprint
 * §5 forbids arbitrary hardcoded confidence and §7 forbids presenting scores as
 * probability. `createDetectionResult` rejects such fields at runtime.
 */
export interface DetectionResult<TKind extends string = string> {
  readonly id: string;
  readonly kind: TKind;
  readonly instrument: InstrumentId;
  readonly timeframe: Timeframe;
  readonly direction: DetectionDirection;
  readonly detectedAt: number;
  /** Only set once the right-side confirmation candles have closed (Blueprint §9). */
  readonly confirmedAt?: number;
  readonly evidence: readonly DetectionEvidence[];
  readonly invalidation?: string;
  readonly dataTimestamp: DataTimestamp;
}
