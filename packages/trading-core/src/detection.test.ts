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

  it("rejects detections without evidence", () => {
    expect(() => createDetectionResult({ ...validDetection, evidence: [] })).toThrow(/evidence/);
  });

  it("rejects confirmation before detection", () => {
    expect(() => createDetectionResult({ ...validDetection, confirmedAt: 900 })).toThrow(/earlier/);
  });
});
