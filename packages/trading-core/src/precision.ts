export type RoundingMode = "down" | "up" | "nearest";

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

/** Number of decimal places needed to represent a positive step size. */
export function decimalPlaces(step: number): number {
  assertPositiveFinite(step, "step");
  const text = step.toString().toLowerCase();
  const [coefficient, exponentText] = text.split("e");
  const coefficientDecimals = (coefficient?.split(".")[1] ?? "").length;

  if (exponentText !== undefined) {
    const exponent = Number(exponentText);
    return Math.max(0, coefficientDecimals - exponent);
  }

  return coefficientDecimals;
}

/** Align a price/quantity to an exchange-provided increment. */
export function alignToStep(value: number, step: number, mode: RoundingMode = "nearest"): number {
  if (!Number.isFinite(value)) throw new RangeError("value must be finite");
  assertPositiveFinite(step, "step");
  if (mode !== "down" && mode !== "up" && mode !== "nearest") {
    throw new TypeError("mode must be down, up, or nearest");
  }

  const ratio = value / step;
  // Scale the tolerance to the magnitude of the ratio to absorb floating-point noise.
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(ratio)) * 4;
  const units = mode === "down" ? Math.floor(ratio + tolerance)
    : mode === "up" ? Math.ceil(ratio - tolerance)
    : Math.round(ratio);

  return Number((units * step).toFixed(Math.min(100, decimalPlaces(step) + 2)));
}

export function formatToStep(value: number, step: number): string {
  return alignToStep(value, step).toFixed(Math.min(100, decimalPlaces(step)));
}
