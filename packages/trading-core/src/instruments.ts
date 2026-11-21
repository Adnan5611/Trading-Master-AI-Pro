import { ValidationError } from "./errors.js";
import {
  INSTRUMENT_IDS,
  TIMEFRAMES,
  type InstrumentConfig,
  type InstrumentId,
  type Timeframe
} from "./types.js";

/**
 * Static instrument identity (Blueprint §2.1).
 *
 * Only the platform's own decisions live here: which venue, which market type
 * and which timeframes the platform is prepared to request. Exchange filters
 * (tick size, step size, min/max quantity, trading status, funding, schedule)
 * are **never** hardcoded — they are loaded from exchange metadata in Phase 2
 * and must be verified at startup.
 */

const CANDIDATE_TIMEFRAMES: readonly Timeframe[] = Object.freeze([...TIMEFRAMES]);

const BTCUSDT_CONFIG: InstrumentConfig = Object.freeze({
  id: "BTCUSDT",
  marketType: "binance-usdm-futures",
  venue: "Binance",
  quoteAsset: "USDT",
  candidateTimeframes: CANDIDATE_TIMEFRAMES
});

const XAUUSDT_CONFIG: InstrumentConfig = Object.freeze({
  id: "XAUUSDT",
  marketType: "binance-tradfi-perpetual",
  venue: "Binance",
  quoteAsset: "USDT",
  candidateTimeframes: CANDIDATE_TIMEFRAMES
});

export const INSTRUMENTS: Readonly<Record<InstrumentId, InstrumentConfig>> = Object.freeze({
  BTCUSDT: BTCUSDT_CONFIG,
  XAUUSDT: XAUUSDT_CONFIG
});

export function isInstrumentId(value: unknown): value is InstrumentId {
  return typeof value === "string" && (INSTRUMENT_IDS as readonly string[]).includes(value);
}

/** Look up a static instrument configuration; unknown ids are rejected, never guessed. */
export function getInstrument(instrument: InstrumentId): InstrumentConfig {
  if (!isInstrumentId(instrument)) {
    throw new ValidationError(
      "INVALID_INSTRUMENT",
      `Unsupported instrument: ${String(instrument)}. Supported: ${INSTRUMENT_IDS.join(", ")}`
    );
  }
  return INSTRUMENTS[instrument];
}

export function listInstruments(): readonly InstrumentConfig[] {
  return INSTRUMENT_IDS.map((id) => INSTRUMENTS[id]);
}

/**
 * Whether the platform is *prepared* to request a timeframe for an instrument.
 *
 * `true` here does not prove exchange support — Phase 2 confirms availability
 * against live exchange metadata before any data is requested.
 */
export function isTimeframeConfigured(instrument: InstrumentId, timeframe: Timeframe): boolean {
  return getInstrument(instrument).candidateTimeframes.includes(timeframe);
}
