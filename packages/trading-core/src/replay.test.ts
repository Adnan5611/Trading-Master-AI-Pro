import { describe, expect, it } from "vitest";
import {
  assertNoDuplicateDetections,
  buildDetectionResult,
  createDetectionId,
  deduplicateDetections
} from "./detection.js";
import { alignTimestampToTimeframe } from "./timeframe.js";
import type { DetectionResult, InstrumentId, Timeframe } from "./types.js";

/**
 * Integration replay test: the same closed-candle sequence must always produce
 * the same detections and ids, with no duplicates and no confidence values.
 */

const CANDLE_MS = 900_000;
const BASE_TIME = alignTimestampToTimeframe(1_700_000_000_000, "15m");

interface ReplayInput {
  readonly instrument: InstrumentId;
  readonly timeframe: Timeframe;
  readonly events: ReadonlyArray<{
    readonly kind: string;
    readonly direction: "bullish" | "bearish";
    readonly candleOffset: number;
    readonly description: string;
  }>;
}

function replay(input: ReplayInput): readonly DetectionResult[] {
  return input.events.map((event) => {
    const eventTime = BASE_TIME + event.candleOffset * CANDLE_MS;
    return buildDetectionResult({
      kind: event.kind,
      instrument: input.instrument,
      timeframe: input.timeframe,
      direction: event.direction,
      // The event is only detectable once its candle has closed.
      detectedAt: eventTime + CANDLE_MS,
      confirmedAt: eventTime + 2 * CANDLE_MS,
      evidence: [
        {
          type: "closed-candle",
          description: event.description,
          candleTimes: [eventTime, eventTime - CANDLE_MS],
          values: { candleOffset: event.candleOffset, closed: true }
        }
      ],
      invalidation: "A close back through the broken structure level",
      dataTimestamp: { eventTime, receivedAt: eventTime + CANDLE_MS + 25 }
    });
  });
}

const sequence: ReplayInput = {
  instrument: "BTCUSDT",
  timeframe: "15m",
  events: [
    { kind: "BOS", direction: "bullish", candleOffset: 0, description: "Broke swing high" },
    { kind: "CHoCH", direction: "bearish", candleOffset: 1, description: "Broke swing low" },
    { kind: "FVG", direction: "bullish", candleOffset: 2, description: "Three-candle imbalance" }
  ]
};

describe("deterministic replay", () => {
  it("reproduces identical ids and payloads across runs", () => {
    const first = replay(sequence);
    const second = replay(sequence);
    expect(first.map((detection) => detection.id)).toEqual(second.map((detection) => detection.id));
    expect(first).toEqual(second);
  });

  it("derives ids from the event identity, not the wall clock", () => {
    const detections = replay(sequence);
    expect(detections[0]?.id).toBe(
      createDetectionId({
        instrument: "BTCUSDT",
        timeframe: "15m",
        kind: "BOS",
        direction: "bullish",
        eventTime: BASE_TIME
      })
    );
    expect(new Set(detections.map((detection) => detection.id)).size).toBe(3);
  });

  it("emits no duplicates and no confidence fields", () => {
    const detections = replay(sequence);
    expect(() => assertNoDuplicateDetections(detections)).not.toThrow();
    for (const detection of detections) {
      expect(Object.keys(detection)).not.toContain("confidence");
      expect(Object.keys(detection)).not.toContain("probability");
      expect(detection.evidence.length).toBeGreaterThan(0);
    }
  });

  it("suppresses a re-emitted detection for an event already seen", () => {
    const detections = replay(sequence);
    const replayedBar = [...detections, detections[0] as DetectionResult];
    expect(() => assertNoDuplicateDetections(replayedBar)).toThrow(/Duplicate detection/);
    expect(deduplicateDetections(replayedBar)).toHaveLength(3);
  });
});
