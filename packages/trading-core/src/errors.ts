/**
 * Typed errors for the Trading Core.
 *
 * `ValidationError` extends `TypeError` (wrong shape/type) and `BoundsError`
 * extends `RangeError` (value outside the accepted range) so callers can rely on
 * idiomatic JavaScript error categories while still matching on `code`.
 */

export type CoreErrorCode =
  | "INVALID_ARGUMENT"
  | "INVALID_TIMESTAMP"
  | "INVALID_STEP"
  | "INVALID_INSTRUMENT"
  | "INVALID_TIMEFRAME"
  | "INVALID_DETECTION"
  | "DUPLICATE_DETECTION";

export class ValidationError extends TypeError {
  readonly code: CoreErrorCode;

  constructor(code: CoreErrorCode, message: string) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
  }
}

export class BoundsError extends RangeError {
  readonly code: CoreErrorCode;

  constructor(code: CoreErrorCode, message: string) {
    super(message);
    this.name = "BoundsError";
    this.code = code;
  }
}
