import { TIMEFRAMES, type Timeframe } from "./types.js";

const TIMEFRAME_MS: Readonly<Record<Timeframe, number>> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "2h": 7_200_000,
  "4h": 14_400_000,
  "1d": 86_400_000
};

export function timeframeToMilliseconds(timeframe: Timeframe): number {
  return TIMEFRAME_MS[timeframe];
}

export function isTimeframe(value: string): value is Timeframe {
  return (TIMEFRAMES as readonly string[]).includes(value);
}

export function getNextCandleOpenTime(openTime: number, timeframe: Timeframe): number {
  return openTime + timeframeToMilliseconds(timeframe);
}
