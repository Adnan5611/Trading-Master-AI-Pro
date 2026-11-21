import { describe, expect, it } from "vitest";
import { BoundsError, ValidationError } from "./errors.js";
import {
  SUPPORTED_TIMEFRAMES,
  alignTimestampToTimeframe,
  assertTimeframe,
  getCandleCloseTime,
  getNextCandleOpenTime,
  isTimeframe,
  isTimestampAligned,
  timeframeToMilliseconds
} from "./timeframe.js";
import { TIMEFRAMES } from "./types.js";

describe("timeframe durations", () => {
  const expected: ReadonlyArray<readonly [string, number]> = [
    ["1m", 60_000],
    ["5m", 300_000],
    ["15m", 900_000],
    ["30m", 1_800_000],
    ["1h", 3_600_000],
    ["2h", 7_200_000],
    ["4h", 14_400_000],
    ["1d", 86_400_000]
  ];

  it.each(expected)("maps %s to %d ms", (timeframe, milliseconds) => {
    expect(timeframeToMilliseconds(timeframe as (typeof TIMEFRAMES)[number])).toBe(milliseconds);
  });

  it("supports exactly the blueprint's eight timeframes, ascending", () => {
    expect(SUPPORTED_TIMEFRAMES).toEqual([...TIMEFRAMES]);
    expect(SUPPORTED_TIMEFRAMES).toHaveLength(8);
  });

  it("rejects unsupported timeframes", () => {
    expect(() => timeframeToMilliseconds("3m" as unknown as "1m")).toThrow(ValidationError);
    expect(() => timeframeToMilliseconds("1w" as unknown as "1m")).toThrow(ValidationError);
  });
});

describe("timeframe guards", () => {
  it("recognizes only configured timeframes", () => {
    expect(isTimeframe("1m")).toBe(true);
    expect(isTimeframe("1d")).toBe(true);
    expect(isTimeframe("3m")).toBe(false);
    expect(isTimeframe("")).toBe(false);
    expect(isTimeframe("60")).toBe(false);
    expect(isTimeframe(60)).toBe(false);
    expect(isTimeframe(null)).toBe(false);
    expect(isTimeframe(undefined)).toBe(false);
  });

  it("asserts with a descriptive error", () => {
    expect(() => assertTimeframe("15m")).not.toThrow();
    expect(() => assertTimeframe("15M")).toThrow(/Unsupported timeframe/);
    expect(() => assertTimeframe(15)).toThrow(ValidationError);
  });
});

describe("candle boundaries", () => {
  it("computes the next candle open time", () => {
    expect(getNextCandleOpenTime(0, "1m")).toBe(60_000);
    expect(getNextCandleOpenTime(0, "1h")).toBe(3_600_000);
    expect(getNextCandleOpenTime(1_700_000_000_000, "15m")).toBe(1_700_000_900_000);
  });

  it("uses the exchange close-time convention (last millisecond inside the interval)", () => {
    expect(getCandleCloseTime(0, "1m")).toBe(59_999);
    expect(getCandleCloseTime(0, "1d")).toBe(86_399_999);
    expect(getCandleCloseTime(1_700_000_000_000, "4h")).toBe(1_700_014_399_999);
  });

  it("rejects invalid open times", () => {
    expect(() => getNextCandleOpenTime(-1, "1m")).toThrow(BoundsError);
    expect(() => getNextCandleOpenTime(1.5, "1m")).toThrow(BoundsError);
    expect(() => getNextCandleOpenTime(Number.NaN, "1m")).toThrow(BoundsError);
    expect(() => getCandleCloseTime(Number.POSITIVE_INFINITY, "1m")).toThrow(BoundsError);
  });
});

describe("timestamp alignment", () => {
  it("floors to the containing 15m bucket", () => {
    expect(alignTimestampToTimeframe(1_700_000_000_000, "15m")).toBe(1_699_999_200_000);
  });

  it("aligns daily candles to UTC midnight without timezone drift", () => {
    const aligned = alignTimestampToTimeframe(1_700_000_000_000, "1d");
    expect(aligned % 86_400_000).toBe(0);
    expect(new Date(aligned).toISOString()).toBe("2023-11-14T00:00:00.000Z");
  });

  it("is idempotent for every supported timeframe", () => {
    const timestamp = 1_700_000_000_123;
    for (const timeframe of TIMEFRAMES) {
      const once = alignTimestampToTimeframe(timestamp, timeframe);
      expect(alignTimestampToTimeframe(once, timeframe)).toBe(once);
      expect(once).toBeLessThanOrEqual(timestamp);
      expect(timestamp - once).toBeLessThan(timeframeToMilliseconds(timeframe));
    }
  });

  it("reports alignment correctly", () => {
    expect(isTimestampAligned(1_699_999_200_000, "15m")).toBe(true);
    expect(isTimestampAligned(1_700_000_000_000, "15m")).toBe(false);
    expect(isTimestampAligned(0, "1d")).toBe(true);
  });

  it("rejects invalid timestamps", () => {
    expect(() => alignTimestampToTimeframe(-1, "1m")).toThrow(BoundsError);
    expect(() => alignTimestampToTimeframe(Number.NaN, "1m")).toThrow(BoundsError);
    expect(() => isTimestampAligned(1.5, "1m")).toThrow(BoundsError);
  });
});
