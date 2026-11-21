import { describe, expect, it } from "vitest";
import { getNextCandleOpenTime, isTimeframe, timeframeToMilliseconds } from "./timeframe.js";

describe("timeframe utilities", () => {
  it("converts every configured timeframe to milliseconds", () => {
    expect(TIMEFRAME_CASES.map(([tf]) => timeframeToMilliseconds(tf))).toEqual([
      60_000, 300_000, 900_000, 1_800_000, 3_600_000, 7_200_000, 14_400_000, 86_400_000
    ]);
  });

  it("recognizes only configured timeframes", () => {
    expect(isTimeframe("15m")).toBe(true);
    expect(isTimeframe("3m")).toBe(false);
  });

  it("calculates the next candle open", () => {
    expect(getNextCandleOpenTime(0, "1h")).toBe(3_600_000);
  });
});

const TIMEFRAME_CASES = [
  ["1m"], ["5m"], ["15m"], ["30m"], ["1h"], ["2h"], ["4h"], ["1d"]
] as const;
