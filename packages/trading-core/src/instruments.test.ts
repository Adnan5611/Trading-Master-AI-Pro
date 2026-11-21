import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors.js";
import {
  INSTRUMENTS,
  getInstrument,
  isInstrumentId,
  isTimeframeConfigured,
  listInstruments
} from "./instruments.js";
import { TIMEFRAMES } from "./types.js";

describe("instrument configuration", () => {
  it("defines the two blueprint instruments with their own market types", () => {
    expect(getInstrument("BTCUSDT").marketType).toBe("binance-usdm-futures");
    expect(getInstrument("XAUUSDT").marketType).toBe("binance-tradfi-perpetual");
    expect(getInstrument("BTCUSDT").venue).toBe("Binance");
    expect(getInstrument("XAUUSDT").quoteAsset).toBe("USDT");
  });

  it("never hardcodes exchange filters or contract specs", () => {
    for (const config of listInstruments()) {
      expect("tickSize" in config).toBe(false);
      expect("quantityStepSize" in config).toBe(false);
      expect("minQuantity" in config).toBe(false);
      expect("tradingStatus" in config).toBe(false);
      expect(Object.keys(config).sort()).toEqual([
        "candidateTimeframes",
        "id",
        "marketType",
        "quoteAsset",
        "venue"
      ]);
    }
  });

  it("lists every candidate timeframe for both instruments", () => {
    for (const config of listInstruments()) {
      expect([...config.candidateTimeframes]).toEqual([...TIMEFRAMES]);
    }
  });

  it("is immutable so runtime metadata cannot be overwritten", () => {
    expect(Object.isFrozen(INSTRUMENTS)).toBe(true);
    expect(Object.isFrozen(getInstrument("BTCUSDT"))).toBe(true);
    expect(Object.isFrozen(getInstrument("BTCUSDT").candidateTimeframes)).toBe(true);
    expect(() => {
      (getInstrument("BTCUSDT") as unknown as { marketType: string }).marketType = "changed";
    }).toThrow(TypeError);
  });
});

describe("instrument guards", () => {
  it("recognizes only configured instruments", () => {
    expect(isInstrumentId("BTCUSDT")).toBe(true);
    expect(isInstrumentId("XAUUSDT")).toBe(true);
    expect(isInstrumentId("XAUUSD")).toBe(false);
    expect(isInstrumentId("btcusdt")).toBe(false);
    expect(isInstrumentId("")).toBe(false);
    expect(isInstrumentId(42)).toBe(false);
    expect(isInstrumentId(null)).toBe(false);
  });

  it("rejects unknown instruments instead of guessing", () => {
    expect(() => getInstrument("ETHUSDT" as unknown as "BTCUSDT")).toThrow(ValidationError);
    expect(() => getInstrument("ETHUSDT" as unknown as "BTCUSDT")).toThrow(/Unsupported instrument/);
    try {
      getInstrument("ETHUSDT" as unknown as "BTCUSDT");
    } catch (error) {
      expect((error as ValidationError).code).toBe("INVALID_INSTRUMENT");
    }
  });

  it("lists exactly two instruments", () => {
    expect(listInstruments().map((config) => config.id)).toEqual(["BTCUSDT", "XAUUSDT"]);
  });
});

describe("timeframe candidacy", () => {
  it("marks all eight timeframes as candidates for both instruments", () => {
    for (const timeframe of TIMEFRAMES) {
      expect(isTimeframeConfigured("BTCUSDT", timeframe)).toBe(true);
      expect(isTimeframeConfigured("XAUUSDT", timeframe)).toBe(true);
    }
  });

  it("treats candidacy as a request plan, not proof of exchange support", () => {
    // Runtime exchange verification (Blueprint §2.2) is Phase 2; this suite pins
    // only the static contract so no fake availability claim can creep in.
    expect(getInstrument("XAUUSDT").candidateTimeframes.length).toBe(TIMEFRAMES.length);
  });
});
