import { BoundsError, ValidationError } from "./errors.js";
import { TIMEFRAMES, type Timeframe } from "./types.js";

/**
 * Timeframe utilities (Blueprint §4.2 “Timeframe Utilities”).
 *
 * All calculations are UTC epoch-millisecond based. Exchange kline boundaries
 * are aligned to the Unix epoch, so flooring is exact and free of local-time or
 * daylight-saving effects.
 */

const TIMEFRAME_MS: Readonly<Record<Timeframe, number>> = Object.freeze({
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "2h": 7_200_000,
  "4h": 14_400_000,
  "1d": 86_400_000
});

/** Supported timeframes in ascending order (Blueprint §2.2). */
export const SUPPORTED_TIMEFRAMES: readonly Timeframe[] = TIMEFRAMES;

function assertEpochMilliseconds(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new BoundsError(
      "INVALID_TIMESTAMP",
      `${field} must be a non-negative safe integer of epoch milliseconds, received ${String(value)}`
    );
  }
}

export function timeframeToMilliseconds(timeframe: Timeframe): number {
  const milliseconds = TIMEFRAME_MS[timeframe];
  if (milliseconds === undefined) {
    throw new ValidationError("INVALID_TIMEFRAME", `Unsupported timeframe: ${String(timeframe)}`);
  }
  return milliseconds;
}

export function isTimeframe(value: unknown): value is Timeframe {
  return typeof value === "string" && (TIMEFRAMES as readonly string[]).includes(value);
}

export function assertTimeframe(value: unknown): asserts value is Timeframe {
  if (!isTimeframe(value)) {
    throw new ValidationError(
      "INVALID_TIMEFRAME",
      `Unsupported timeframe: ${String(value)}. Supported: ${TIMEFRAMES.join(", ")}`
    );
  }
}

/** Open time of the candle that follows the candle opening at `openTime`. */
export function getNextCandleOpenTime(openTime: number, timeframe: Timeframe): number {
  assertEpochMilliseconds(openTime, "openTime");
  return openTime + timeframeToMilliseconds(timeframe);
}

/**
 * Close time of a candle, using the exchange convention of the last millisecond
 * inside the interval (`openTime + duration - 1`).
 */
export function getCandleCloseTime(openTime: number, timeframe: Timeframe): number {
  return getNextCandleOpenTime(openTime, timeframe) - 1;
}

/** Floor an arbitrary timestamp to the open time of the candle containing it. */
export function alignTimestampToTimeframe(timestamp: number, timeframe: Timeframe): number {
  assertEpochMilliseconds(timestamp, "timestamp");
  const milliseconds = timeframeToMilliseconds(timeframe);
  return Math.floor(timestamp / milliseconds) * milliseconds;
}

/** True when `timestamp` sits exactly on a candle boundary for `timeframe`. */
export function isTimestampAligned(timestamp: number, timeframe: Timeframe): boolean {
  return alignTimestampToTimeframe(timestamp, timeframe) === timestamp;
}
