import { BoundsError, ValidationError } from "./errors.js";
import { isInstrumentId } from "./instruments.js";
import { isTimeframe } from "./timeframe.js";
import type {
  DetectionDirection,
  DetectionEvidence,
  DetectionResult,
  InstrumentId,
  Timeframe
} from "./types.js";

/**
 * Common detection result contract shared by every engine (Blueprint §4.2,
 * “Shared Detection Results”).
 *
 * Rules enforced here:
 * - a detection always carries evidence;
 * - timestamps are consistent (no detection before the data event, no
 *   confirmation before detection) so look-ahead bugs surface immediately;
 * - confidence/probability/win-rate fields are rejected — Blueprint §5 forbids
 *   arbitrary hardcoded confidence and §7 forbids presenting scores as probability;
 * - ids are deterministic, so replaying the same data produces the same id.
 */

const DETECTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,127}$/;

/** Keys that would smuggle a confidence/probability claim into a detection. */
const FORBIDDEN_SCORE_KEYS = /^(confidence|confidenceScore|probability|winRate|win_rate|accuracy)$/i;

const DIRECTIONS: readonly DetectionDirection[] = ["bullish", "bearish", "neutral"];

const FNV_PRIME = 0x01000193;
const FNV_OFFSET_A = 0x811c9dc5;
const FNV_OFFSET_B = 0x9747b28c;

function fnv1a32(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

function toHex8(value: number): string {
  return value.toString(16).padStart(8, "0");
}

function assertEpochMilliseconds(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new BoundsError(
      "INVALID_TIMESTAMP",
      `${field} must be a non-negative safe integer of epoch milliseconds, received ${String(value)}`
    );
  }
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError("INVALID_DETECTION", `${field} must be a non-empty string`);
  }
}

function assertNoScoreFields(value: object, path: string): void {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_SCORE_KEYS.test(key)) {
      throw new ValidationError(
        "INVALID_DETECTION",
        `${path}.${key} is not allowed: detections must not carry confidence or probability values (Blueprint §5, §7)`
      );
    }
  }
}

function validateEvidence(evidence: DetectionEvidence, index: number): DetectionEvidence {
  if (typeof evidence !== "object" || evidence === null) {
    throw new ValidationError("INVALID_DETECTION", `evidence[${index}] must be an object`);
  }
  const path = `evidence[${index}]`;
  assertNoScoreFields(evidence, path);
  assertNonEmptyString(evidence.type, `${path}.type`);
  assertNonEmptyString(evidence.description, `${path}.description`);

  let candleTimes: readonly number[] | undefined;
  if (evidence.candleTimes !== undefined) {
    if (!Array.isArray(evidence.candleTimes) || evidence.candleTimes.length === 0) {
      throw new ValidationError(
        "INVALID_DETECTION",
        `${path}.candleTimes must be a non-empty array of epoch milliseconds`
      );
    }
    candleTimes = Object.freeze(
      evidence.candleTimes.map((time, timeIndex) => {
        assertEpochMilliseconds(time, `${path}.candleTimes[${timeIndex}]`);
        return time;
      })
    );
  }

  let values: Readonly<Record<string, number | string | boolean>> | undefined;
  if (evidence.values !== undefined) {
    if (typeof evidence.values !== "object" || evidence.values === null) {
      throw new ValidationError("INVALID_DETECTION", `${path}.values must be an object`);
    }
    assertNoScoreFields(evidence.values, `${path}.values`);
    const entries: Array<[string, number | string | boolean]> = [];
    for (const [key, raw] of Object.entries(evidence.values)) {
      assertNonEmptyString(key, `${path}.values key`);
      if (typeof raw === "number" && !Number.isFinite(raw)) {
        throw new BoundsError(
          "INVALID_DETECTION",
          `${path}.values.${key} must be a finite number when numeric`
        );
      }
      if (typeof raw !== "number" && typeof raw !== "string" && typeof raw !== "boolean") {
        throw new ValidationError(
          "INVALID_DETECTION",
          `${path}.values.${key} must be a number, string or boolean`
        );
      }
      entries.push([key, raw]);
    }
    values = Object.freeze(Object.fromEntries(entries) as Record<string, number | string | boolean>);
  }

  const frozen: DetectionEvidence = {
    type: evidence.type.trim(),
    description: evidence.description.trim(),
    ...(candleTimes !== undefined ? { candleTimes } : {}),
    ...(values !== undefined ? { values } : {})
  };
  return Object.freeze(frozen);
}

/**
 * Validate and freeze a detection result. Throws on any contract violation
 * instead of silently returning a partial object.
 */
export function createDetectionResult<TKind extends string>(
  result: DetectionResult<TKind>
): DetectionResult<TKind> {
  if (typeof result !== "object" || result === null) {
    throw new ValidationError("INVALID_DETECTION", "detection must be an object");
  }
  assertNoScoreFields(result, "detection");

  assertNonEmptyString(result.id, "id");
  const id = result.id.trim();
  if (!DETECTION_ID_PATTERN.test(id)) {
    throw new ValidationError(
      "INVALID_DETECTION",
      `id "${id}" must match ${String(DETECTION_ID_PATTERN)} (3–128 chars: letters, digits, ":", ".", "_", "-")`
    );
  }

  assertNonEmptyString(result.kind, "kind");
  const kind = result.kind.trim() as TKind;

  if (!isInstrumentId(result.instrument)) {
    throw new ValidationError("INVALID_INSTRUMENT", `Unsupported instrument: ${String(result.instrument)}`);
  }
  if (!isTimeframe(result.timeframe)) {
    // `result.timeframe` is a string union at compile time; invalid values arrive via JSON/untyped callers.
    throw new ValidationError("INVALID_TIMEFRAME", `Unsupported timeframe: ${String(result.timeframe)}`);
  }
  if (!DIRECTIONS.includes(result.direction)) {
    throw new ValidationError(
      "INVALID_DETECTION",
      `direction must be one of ${DIRECTIONS.join(", ")}, received ${String(result.direction)}`
    );
  }

  assertEpochMilliseconds(result.detectedAt, "detectedAt");
  if (result.confirmedAt !== undefined) {
    assertEpochMilliseconds(result.confirmedAt, "confirmedAt");
    if (result.confirmedAt < result.detectedAt) {
      throw new BoundsError("INVALID_TIMESTAMP", "confirmedAt cannot be earlier than detectedAt");
    }
  }

  if (typeof result.dataTimestamp !== "object" || result.dataTimestamp === null) {
    throw new ValidationError("INVALID_DETECTION", "dataTimestamp is required");
  }
  const { eventTime, receivedAt } = result.dataTimestamp;
  assertEpochMilliseconds(eventTime, "dataTimestamp.eventTime");
  assertEpochMilliseconds(receivedAt, "dataTimestamp.receivedAt");
  if (receivedAt < eventTime) {
    throw new BoundsError("INVALID_TIMESTAMP", "dataTimestamp.receivedAt cannot precede eventTime");
  }
  if (result.detectedAt < eventTime) {
    throw new BoundsError(
      "INVALID_TIMESTAMP",
      "detectedAt cannot precede dataTimestamp.eventTime (detection would use data that did not exist yet)"
    );
  }

  if (!Array.isArray(result.evidence) || result.evidence.length === 0) {
    throw new ValidationError("INVALID_DETECTION", "A detection must include at least one evidence entry");
  }
  const evidence = Object.freeze(result.evidence.map(validateEvidence));

  let invalidation: string | undefined;
  if (result.invalidation !== undefined) {
    assertNonEmptyString(result.invalidation, "invalidation");
    invalidation = result.invalidation.trim();
  }

  const validated: DetectionResult<TKind> = {
    id,
    kind,
    instrument: result.instrument,
    timeframe: result.timeframe,
    direction: result.direction,
    detectedAt: result.detectedAt,
    ...(result.confirmedAt !== undefined ? { confirmedAt: result.confirmedAt } : {}),
    evidence,
    ...(invalidation !== undefined ? { invalidation } : {}),
    dataTimestamp: Object.freeze({ eventTime, receivedAt })
  };
  return Object.freeze(validated);
}

export interface DetectionIdentity {
  readonly instrument: InstrumentId;
  readonly timeframe: Timeframe;
  readonly kind: string;
  readonly direction: DetectionDirection;
  readonly eventTime: number;
}

/**
 * Deterministic detection id derived from the detection's identity.
 *
 * Replaying identical data yields identical ids, which makes duplicate
 * suppression and reproducible backtests possible without a database sequence.
 */
export function createDetectionId(identity: DetectionIdentity): string {
  if (!isInstrumentId(identity.instrument)) {
    throw new ValidationError("INVALID_INSTRUMENT", `Unsupported instrument: ${String(identity.instrument)}`);
  }
  if (!isTimeframe(identity.timeframe)) {
    throw new ValidationError("INVALID_TIMEFRAME", `Unsupported timeframe: ${String(identity.timeframe)}`);
  }
  if (!DIRECTIONS.includes(identity.direction)) {
    throw new ValidationError("INVALID_DETECTION", `direction must be one of ${DIRECTIONS.join(", ")}`);
  }
  assertNonEmptyString(identity.kind, "kind");
  assertEpochMilliseconds(identity.eventTime, "eventTime");

  const canonical = [
    identity.instrument,
    identity.timeframe,
    identity.kind.trim(),
    identity.direction,
    identity.eventTime
  ].join("|");
  return `det_${toHex8(fnv1a32(canonical, FNV_OFFSET_A))}${toHex8(fnv1a32(canonical, FNV_OFFSET_B))}`;
}

/** Detection input where the id may be supplied or derived deterministically. */
export type NewDetection<TKind extends string> = Omit<DetectionResult<TKind>, "id"> & {
  readonly id?: string;
};

/** Build (and validate) a detection, deriving a deterministic id when none is given. */
export function buildDetectionResult<TKind extends string>(
  input: NewDetection<TKind>
): DetectionResult<TKind> {
  const id =
    input.id ??
    createDetectionId({
      instrument: input.instrument,
      timeframe: input.timeframe,
      kind: input.kind,
      direction: input.direction,
      eventTime: input.dataTimestamp.eventTime
    });
  return createDetectionResult({ ...input, id } as DetectionResult<TKind>);
}

/**
 * Canonical key for "the same event". Two detections sharing this key describe
 * the same instrument/timeframe/kind/direction/event-time occurrence and must
 * not both be emitted (Blueprint §17: no duplicate signals for the same event).
 */
export function detectionEventKey(result: DetectionResult): string {
  return [
    result.instrument,
    result.timeframe,
    result.kind.trim(),
    result.direction,
    result.dataTimestamp.eventTime
  ].join("|");
}

/** Throw if the same event (or the same id) appears more than once. */
export function assertNoDuplicateDetections(results: readonly DetectionResult[]): void {
  const seenEvents = new Map<string, string>();
  const seenIds = new Set<string>();
  for (const result of results) {
    const key = detectionEventKey(result);
    const existing = seenEvents.get(key);
    if (existing !== undefined) {
      throw new ValidationError(
        "DUPLICATE_DETECTION",
        `Duplicate detection for event "${key}" (ids: ${existing}, ${result.id})`
      );
    }
    if (seenIds.has(result.id)) {
      throw new ValidationError("DUPLICATE_DETECTION", `Duplicate detection id "${result.id}"`);
    }
    seenEvents.set(key, result.id);
    seenIds.add(result.id);
  }
}

/** Keep the first detection per event, dropping later duplicates. */
export function deduplicateDetections(results: readonly DetectionResult[]): readonly DetectionResult[] {
  const seen = new Set<string>();
  const unique: DetectionResult[] = [];
  for (const result of results) {
    const key = detectionEventKey(result);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(result);
  }
  return Object.freeze(unique);
}
