import { describe, expect, it } from "vitest";
import {
  assertNoDuplicateDetections,
  buildDetectionResult,
  createDetectionId,
  createDetectionResult,
  deduplicateDetections,
  detectionEventKey
} from "./detection.js";
import { BoundsError, ValidationError } from "./errors.js";
import type { DetectionResult } from "./types.js";

const EVENT_TIME = 1_700_000_000_000;
const CANDLE_MS = 900_000;

const validDetection: DetectionResult<"BOS"> = {
  id: "det_bos_btcusdt_15m_1700000000000",
  kind: "BOS",
  instrument: "BTCUSDT",
  timeframe: "15m",
  direction: "bullish",
  detectedAt: EVENT_TIME + CANDLE_MS,
  confirmedAt: EVENT_TIME + 2 * CANDLE_MS,
  evidence: [
    {
      type: "structure-break",
      description: "Closed 15m candle broke the prior confirmed swing high",
      candleTimes: [EVENT_TIME, EVENT_TIME - CANDLE_MS],
      values: { swingHigh: 35_000.5, breakDistance: 12.25, closed: true }
    }
  ],
  invalidation: "A 15m close back below the broken swing high",
  dataTimestamp: { eventTime: EVENT_TIME, receivedAt: EVENT_TIME + CANDLE_MS + 50 }
};

function mutate<T>(value: T, key: string, next: unknown): T {
  return { ...value, [key]: next } as T;
}

describe("createDetectionResult", () => {
  it("accepts an evidence-backed detection and preserves its fields", () => {
    expect(createDetectionResult(validDetection)).toEqual(validDetection);
  });

  it("returns a deeply frozen result", () => {
    const result = createDetectionResult(validDetection);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.evidence)).toBe(true);
    expect(Object.isFrozen(result.evidence[0])).toBe(true);
    expect(Object.isFrozen(result.dataTimestamp)).toBe(true);
    expect(() => {
      (result as unknown as { kind: string }).kind = "CHoCH";
    }).toThrow(TypeError);
    expect(() => {
      (result.evidence[0] as unknown as { description: string }).description = "forged";
    }).toThrow(TypeError);
  });

  it("trims id, kind and evidence text", () => {
    const result = createDetectionResult({
      ...validDetection,
      id: `  ${validDetection.id}  `,
      kind: "  BOS  ",
      evidence: [{ type: "  structure-break ", description: "  broke swing high  " }],
      invalidation: "  invalidated on close below  "
    });
    expect(result.id).toBe(validDetection.id);
    expect(result.kind).toBe("BOS");
    expect(result.evidence[0]?.description).toBe("broke swing high");
    expect(result.invalidation).toBe("invalidated on close below");
  });

  it("requires evidence", () => {
    expect(() => createDetectionResult({ ...validDetection, evidence: [] })).toThrow(/evidence/);
    expect(() =>
      createDetectionResult(mutate(validDetection, "evidence", undefined))
    ).toThrow(/evidence/);
  });

  it("rejects evidence without a type or description", () => {
    expect(() =>
      createDetectionResult({
        ...validDetection,
        evidence: [{ type: "structure-break", description: "   " }]
      })
    ).toThrow(/description/);
    expect(() =>
      createDetectionResult({
        ...validDetection,
        evidence: [{ type: "", description: "broke swing high" }]
      })
    ).toThrow(/type/);
  });

  it("rejects empty or unordered evidence candle times and non-finite values", () => {
    expect(() =>
      createDetectionResult({
        ...validDetection,
        evidence: [{ type: "structure-break", description: "broke", candleTimes: [] }]
      })
    ).toThrow(/candleTimes/);
    expect(() =>
      createDetectionResult({
        ...validDetection,
        evidence: [{ type: "structure-break", description: "broke", candleTimes: [1.5] }]
      })
    ).toThrow(BoundsError);
    expect(() =>
      createDetectionResult({
        ...validDetection,
        evidence: [{ type: "structure-break", description: "broke", values: { ratio: Number.NaN } }]
      })
    ).toThrow(BoundsError);
  });

  it("rejects confidence and probability fields (no arbitrary confidence)", () => {
    expect(() =>
      createDetectionResult(mutate(validDetection, "confidence", 0.82) as DetectionResult<"BOS">)
    ).toThrow(/confidence|not allowed/);
    expect(() =>
      createDetectionResult(mutate(validDetection, "probability", 82) as DetectionResult<"BOS">)
    ).toThrow(/not allowed/);
    expect(() =>
      createDetectionResult(mutate(validDetection, "winRate", 0.6) as DetectionResult<"BOS">)
    ).toThrow(/not allowed/);
    expect(() =>
      createDetectionResult({
        ...validDetection,
        evidence: [
          { type: "structure-break", description: "broke", values: { confidence: 0.9 } }
        ]
      })
    ).toThrow(/not allowed/);
  });

  it("rejects timestamps that would require future data", () => {
    expect(() => createDetectionResult({ ...validDetection, detectedAt: EVENT_TIME - 1 })).toThrow(
      /precede/
    );
    expect(() =>
      createDetectionResult({
        ...validDetection,
        dataTimestamp: { eventTime: EVENT_TIME, receivedAt: EVENT_TIME - 1 }
      })
    ).toThrow(/precede/);
    expect(() => createDetectionResult({ ...validDetection, confirmedAt: EVENT_TIME })).toThrow(
      /earlier/
    );
  });

  it("rejects non-integer or negative timestamps", () => {
    for (const detectedAt of [1.5, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(() => createDetectionResult({ ...validDetection, detectedAt })).toThrow(BoundsError);
    }
    expect(() =>
      createDetectionResult({
        ...validDetection,
        dataTimestamp: { eventTime: EVENT_TIME, receivedAt: 1.5 }
      })
    ).toThrow(BoundsError);
  });

  it("rejects malformed ids", () => {
    for (const id of ["", "  ", "x", "bad id", "det/1", "id#1"]) {
      expect(() => createDetectionResult({ ...validDetection, id })).toThrow(ValidationError);
    }
  });

  it("rejects unknown instruments, timeframes and directions", () => {
    expect(() =>
      createDetectionResult(mutate(validDetection, "instrument", "ETHUSDT") as DetectionResult<"BOS">)
    ).toThrow(/Unsupported instrument/);
    expect(() =>
      createDetectionResult(mutate(validDetection, "timeframe", "3m") as DetectionResult<"BOS">)
    ).toThrow(/Unsupported timeframe/);
    expect(() =>
      createDetectionResult(mutate(validDetection, "direction", "sideways") as DetectionResult<"BOS">)
    ).toThrow(/direction/);
  });

  it("rejects an empty invalidation string when the field is present", () => {
    expect(() => createDetectionResult({ ...validDetection, invalidation: "   " })).toThrow(
      /invalidation/
    );
  });

  it("exposes a typed error code for callers", () => {
    try {
      createDetectionResult({ ...validDetection, evidence: [] });
      throw new Error("expected a validation failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).code).toBe("INVALID_DETECTION");
    }
  });
});

describe("createDetectionId", () => {
  const identity = {
    instrument: "BTCUSDT" as const,
    timeframe: "15m" as const,
    kind: "BOS",
    direction: "bullish" as const,
    eventTime: EVENT_TIME
  };

  it("is deterministic across repeated calls and replays", () => {
    const first = createDetectionId(identity);
    const second = createDetectionId({ ...identity });
    expect(first).toBe(second);
    expect(first).toMatch(/^det_[0-9a-f]{16}$/);
  });

  it("changes when the event identity changes", () => {
    const base = createDetectionId(identity);
    expect(createDetectionId({ ...identity, kind: "CHoCH" })).not.toBe(base);
    expect(createDetectionId({ ...identity, direction: "bearish" })).not.toBe(base);
    expect(createDetectionId({ ...identity, timeframe: "1h" })).not.toBe(base);
    expect(createDetectionId({ ...identity, instrument: "XAUUSDT" })).not.toBe(base);
    expect(createDetectionId({ ...identity, eventTime: EVENT_TIME + 1 })).not.toBe(base);
  });

  it("rejects invalid identity inputs", () => {
    expect(() => createDetectionId({ ...identity, instrument: "ETHUSDT" as never })).toThrow(
      /Unsupported instrument/
    );
    expect(() => createDetectionId({ ...identity, timeframe: "3m" as never })).toThrow(
      /Unsupported timeframe/
    );
    expect(() => createDetectionId({ ...identity, direction: "up" as never })).toThrow(/direction/);
    expect(() => createDetectionId({ ...identity, kind: " " })).toThrow(/kind/);
    expect(() => createDetectionId({ ...identity, eventTime: 1.5 })).toThrow(BoundsError);
  });
});

describe("buildDetectionResult", () => {
  const input = {
    kind: "FVG",
    instrument: "XAUUSDT",
    timeframe: "1h",
    direction: "bearish",
    detectedAt: EVENT_TIME + 3_600_000,
    confirmedAt: EVENT_TIME + 7_200_000,
    evidence: [
      {
        type: "three-candle-imbalance",
        description: "Gap between candle 1 high and candle 3 low",
        candleTimes: [EVENT_TIME, EVENT_TIME + 3_600_000, EVENT_TIME + 7_200_000]
      }
    ],
    dataTimestamp: { eventTime: EVENT_TIME, receivedAt: EVENT_TIME + 3_600_010 }
  } as const;

  it("derives a deterministic id when none is supplied", () => {
    const first = buildDetectionResult(input);
    const second = buildDetectionResult(input);
    expect(first.id).toBe(second.id);
    expect(first.id).toBe(
      createDetectionId({
        instrument: "XAUUSDT",
        timeframe: "1h",
        kind: "FVG",
        direction: "bearish",
        eventTime: EVENT_TIME
      })
    );
  });

  it("keeps an explicitly supplied id", () => {
    expect(buildDetectionResult({ ...input, id: "det_explicit_1" }).id).toBe("det_explicit_1");
  });

  it("produces different ids for different events on the same instrument", () => {
    const later = buildDetectionResult({
      ...input,
      dataTimestamp: { eventTime: EVENT_TIME + 3_600_000, receivedAt: EVENT_TIME + 7_200_010 }
    });
    expect(later.id).not.toBe(buildDetectionResult(input).id);
  });
});

describe("duplicate detection handling", () => {
  const first = createDetectionResult(validDetection);
  const duplicateOfSameEvent = createDetectionResult({
    ...validDetection,
    id: "det_bos_btcusdt_15m_copy"
  });

  it("derives one canonical event key", () => {
    expect(detectionEventKey(first)).toBe(detectionEventKey(duplicateOfSameEvent));
    expect(detectionEventKey(first)).toBe(`BTCUSDT|15m|BOS|bullish|${EVENT_TIME}`);
  });

  it("rejects the same event twice (Blueprint §17)", () => {
    expect(() => assertNoDuplicateDetections([first, duplicateOfSameEvent])).toThrow(
      /Duplicate detection/
    );
    try {
      assertNoDuplicateDetections([first, duplicateOfSameEvent]);
    } catch (error) {
      expect((error as ValidationError).code).toBe("DUPLICATE_DETECTION");
    }
  });

  it("rejects a reused id even for a different event", () => {
    const otherEvent = createDetectionResult({
      ...validDetection,
      dataTimestamp: { eventTime: EVENT_TIME + CANDLE_MS, receivedAt: EVENT_TIME + 2 * CANDLE_MS }
    });
    expect(() =>
      assertNoDuplicateDetections([first, { ...otherEvent, id: first.id }])
    ).toThrow(/Duplicate detection id/);
  });

  it("accepts distinct events", () => {
    const otherDirection = createDetectionResult({
      ...validDetection,
      id: "det_bearish_same_time",
      direction: "bearish"
    });
    expect(() => assertNoDuplicateDetections([first, otherDirection])).not.toThrow();
  });

  it("deduplicates while preserving order and freezing the output", () => {
    const unique = deduplicateDetections([first, duplicateOfSameEvent]);
    expect(unique).toHaveLength(1);
    expect(unique[0]?.id).toBe(first.id);
    expect(Object.isFrozen(unique)).toBe(true);
  });
});
