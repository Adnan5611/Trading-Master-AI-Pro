import { describe, expect, it } from "vitest";
import { createDetectionResult } from "./detection.js";

const validDetection = {
  id: "det-1",
  kind: "BOS",
  instrument: "BTCUSDT" as const,
  timeframe: "15m" as const,
  direction: "bullish" as const,
  detectedAt: 1_000,
  confirmedAt: 1_100,
  evidence: [{ type: "structure-break", description: "Closed candle broke prior swing high" }],
  dataTimestamp: { eventTime: 1_100, receivedAt: 1_105 }
};

describe("common detection result", () => {
  it("accepts an evidence-backed detection", () => {
    expect(createDetectionResult(validDetection)).toEqual(validDetection);
  });

  it("accepts a detection that is not confirmed yet", () => {
    const { confirmedAt: _confirmedAt, ...unconfirmed } = validDetection;
    expect(createDetectionResult(unconfirmed)).toEqual(unconfirmed);
  });

  it("rejects detections without evidence", () => {
    expect(() => createDetectionResult({ ...validDetection, evidence: [] })).toThrow(/evidence/);
  });

  it("rejects an empty detection id", () => {
    expect(() => createDetectionResult({ ...validDetection, id: "  " })).toThrow(/id/);
  });

  it("rejects non-finite detection and data timestamps", () => {
    expect(() => createDetectionResult({ ...validDetection, detectedAt: Number.NaN })).toThrow(/timestamps/);
    expect(() => createDetectionResult({
      ...validDetection,
      dataTimestamp: { ...validDetection.dataTimestamp, receivedAt: Number.POSITIVE_INFINITY }
    })).toThrow(/timestamps/);
  });

  it("rejects a non-finite confirmation timestamp", () => {
    expect(() => createDetectionResult({ ...validDetection, confirmedAt: Number.NaN })).toThrow(/confirmedAt/);
  });

  it("rejects confirmation before detection", () => {
    expect(() => createDetectionResult({ ...validDetection, confirmedAt: 900 })).toThrow(/earlier/);
  });
});
