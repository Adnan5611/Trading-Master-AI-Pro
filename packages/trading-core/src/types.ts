export const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];
export type InstrumentId = "BTCUSDT" | "XAUUSDT";
export type MarketType = "binance-usdm-futures" | "binance-tradfi-perpetual";
export type TradeDirection = "bullish" | "bearish";
export type SignalDirection = "BUY" | "SELL" | "WAIT" | "NO SIGNAL";

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

export interface InstrumentConfig {
  readonly id: InstrumentId;
  readonly marketType: MarketType;
  readonly venue: "Binance";
  readonly quoteAsset: "USDT";
  readonly supportedTimeframes: readonly Timeframe[];
}

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

export interface DetectionResult<TKind extends string = string> {
  readonly id: string;
  readonly kind: TKind;
  readonly instrument: InstrumentId;
  readonly timeframe: Timeframe;
  readonly direction: TradeDirection | "neutral";
  readonly detectedAt: number;
  readonly confirmedAt?: number;
  readonly evidence: readonly DetectionEvidence[];
  readonly invalidation?: string;
  readonly dataTimestamp: DataTimestamp;
}
