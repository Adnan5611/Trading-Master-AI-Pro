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
  if (text.includes("e-")) {
    const [coefficient, exponent] = text.split("e-");
    return Math.max(0, Number(exponent) - ((coefficient?.split(".")[1]?.length) ?? 0));
  }
  return (text.split(".")[1] ?? "").length;
}

/** Align a price/quantity to an exchange-provided increment. */
export function alignToStep(value: number, step: number, mode: RoundingMode = "nearest"): number {
  if (!Number.isFinite(value)) throw new RangeError("value must be finite");
  assertPositiveFinite(step, "step");
  const ratio = value / step;
  const units = mode === "down" ? Math.floor(ratio + 1e-10)
    : mode === "up" ? Math.ceil(ratio - 1e-10)
    : Math.round(ratio);
  return Number((units * step).toFixed(Math.min(12, decimalPlaces(step) + 2)));
}

export function formatToStep(value: number, step: number): string {
  return alignToStep(value, step).toFixed(decimalPlaces(step));
}
