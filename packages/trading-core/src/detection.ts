import type { DetectionResult } from "./types.js";

/** Build a typed detection result without inventing a confidence/probability score. */
export function createDetectionResult<TKind extends string>(
  result: DetectionResult<TKind>
): DetectionResult<TKind> {
  if (!result.id.trim()) throw new TypeError("Detection id cannot be empty");
  if (result.evidence.length === 0) throw new TypeError("A detection must include evidence");
  if (!Number.isFinite(result.detectedAt) || !Number.isFinite(result.dataTimestamp.eventTime)
    || !Number.isFinite(result.dataTimestamp.receivedAt)) {
    throw new TypeError("Detection timestamps must be finite numbers");
  }
  if (result.confirmedAt !== undefined && !Number.isFinite(result.confirmedAt)) {
    throw new TypeError("confirmedAt must be a finite number");
  }
  if (result.confirmedAt !== undefined && result.confirmedAt < result.detectedAt) {
    throw new RangeError("confirmedAt cannot be earlier than detectedAt");
  }
  return result;
}
