import type { InstrumentConfig, InstrumentId, Timeframe } from "./types.js";

const ALL_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"] as const satisfies readonly Timeframe[];

/**
 * Static identity only. Exchange filters and actual timeframe availability
 * must be loaded and verified from exchange metadata at runtime.
 */
export const INSTRUMENTS: Readonly<Record<InstrumentId, InstrumentConfig>> = {
  BTCUSDT: {
    id: "BTCUSDT",
    marketType: "binance-usdm-futures",
    venue: "Binance",
    quoteAsset: "USDT",
    supportedTimeframes: ALL_TIMEFRAMES
  },
  XAUUSDT: {
    id: "XAUUSDT",
    marketType: "binance-tradfi-perpetual",
    venue: "Binance",
    quoteAsset: "USDT",
    supportedTimeframes: ALL_TIMEFRAMES
  }
};

export function getInstrument(id: InstrumentId): InstrumentConfig {
  return INSTRUMENTS[id];
}

export function isTimeframeConfigured(id: InstrumentId, timeframe: Timeframe): boolean {
  return INSTRUMENTS[id].supportedTimeframes.includes(timeframe);
}
