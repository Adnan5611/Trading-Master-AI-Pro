import { describe, expect, it } from "vitest";
import { getInstrument, isTimeframeConfigured } from "./instruments.js";

describe("instrument configuration", () => {
  it("defines the two blueprint instruments without hardcoding exchange filters", () => {
    expect(getInstrument("BTCUSDT").marketType).toBe("binance-usdm-futures");
    expect(getInstrument("XAUUSDT").marketType).toBe("binance-tradfi-perpetual");
    expect("tickSize" in getInstrument("BTCUSDT")).toBe(false);
  });

  it("exposes the initial timeframe set as configured candidates", () => {
    expect(isTimeframeConfigured("BTCUSDT", "1m")).toBe(true);
    expect(isTimeframeConfigured("XAUUSDT", "1d")).toBe(true);
  });
});
