import { BoundsError, ValidationError } from "./errors.js";

/**
 * Price/quantity precision utilities (Blueprint §4.2 “Price Precision Utilities”).
 *
 * Exchange tick sizes and quantity steps are decimal values such as `0.01`,
 * `0.001` or `1e-8`. JavaScript renders small values in scientific notation
 * (`2.5e-7`), so decimal counting is done on the string representation and the
 * exponent is always added to the mantissa's decimal digits.
 */

export type RoundingMode = "down" | "up" | "nearest";

/** Double precision supports 15–17 significant decimals; beyond this, step maths is unsafe. */
export const MAX_SUPPORTED_DECIMALS = 15;

function assertPositiveStep(step: number): void {
  if (typeof step !== "number" || !Number.isFinite(step) || step <= 0) {
    throw new BoundsError(
      "INVALID_STEP",
      `step must be a positive finite number, received ${String(step)}`
    );
  }
}

/**
 * Number of decimal places required to represent a positive step size.
 *
 * Handles plain (`0.0001`) and scientific (`2.5e-7`, `1e-8`) representations.
 */
export function decimalPlaces(step: number): number {
  assertPositiveStep(step);
  const text = step.toString().toLowerCase();
  const [mantissa = "", exponentPart] = text.split("e");
  const mantissaDecimals = (mantissa.split(".")[1] ?? "").length;
  const exponent = exponentPart === undefined ? 0 : Number(exponentPart);
  if (!Number.isInteger(exponent)) {
    throw new BoundsError("INVALID_STEP", `step has an unparseable exponent: ${text}`);
  }
  // value = mantissaDigits × 10^(exponent - mantissaDecimals)
  return Math.max(0, mantissaDecimals - exponent);
}

/**
 * Align a price or quantity to an exchange increment.
 *
 * `down` floors toward -∞ and `up` ceilings toward +∞ (so negative values keep
 * their mathematical meaning); `nearest` uses `Math.round`. Binary floating
 * point noise is absorbed with a relative tolerance before rounding, and the
 * result is normalised back to the step's decimal precision.
 */
export function alignToStep(value: number, step: number, mode: RoundingMode = "nearest"): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BoundsError("INVALID_ARGUMENT", `value must be a finite number, received ${String(value)}`);
  }
  if (mode !== "down" && mode !== "up" && mode !== "nearest") {
    throw new ValidationError("INVALID_ARGUMENT", `mode must be "down", "up" or "nearest", received ${String(mode)}`);
  }
  assertPositiveStep(step);
  const places = decimalPlaces(step);
  if (places > MAX_SUPPORTED_DECIMALS) {
    throw new BoundsError(
      "INVALID_STEP",
      `step ${String(step)} needs ${places} decimals; beyond ${MAX_SUPPORTED_DECIMALS} results are not exact in double precision`
    );
  }
  const ratio = value / step;
  if (!Number.isFinite(ratio)) {
    throw new BoundsError("INVALID_ARGUMENT", "value / step is not finite");
  }
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(ratio)) * 8;
  const units =
    mode === "down"
      ? Math.floor(ratio + tolerance)
      : mode === "up"
        ? Math.ceil(ratio - tolerance)
        : Math.round(ratio);
  const aligned = Number((units * step).toFixed(places));
  // Normalise negative zero so comparisons and serialisation stay predictable.
  return aligned === 0 ? 0 : aligned;
}

/** True when `value` already sits on a multiple of `step` (within float tolerance). */
export function isMultipleOfStep(value: number, step: number): boolean {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BoundsError("INVALID_ARGUMENT", `value must be a finite number, received ${String(value)}`);
  }
  assertPositiveStep(step);
  const ratio = value / step;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(ratio)) * 8;
  return Math.abs(ratio - Math.round(ratio)) <= tolerance;
}

/** Format a value aligned to the step, using exactly the step's decimal precision. */
export function formatToStep(value: number, step: number): string {
  const places = decimalPlaces(step);
  return alignToStep(value, step).toFixed(places);
}
