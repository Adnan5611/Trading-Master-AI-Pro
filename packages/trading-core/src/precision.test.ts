import { describe, expect, it } from "vitest";
import { alignToStep, decimalPlaces, formatToStep } from "./precision.js";

describe("price precision utilities", () => {
  it("counts decimal places including small decimal increments and scientific notation", () => {
    expect(decimalPlaces(0.01)).toBe(2);
    expect(decimalPlaces(0.0001)).toBe(4);
    expect(decimalPlaces(1.2e-7)).toBe(8);
    expect(decimalPlaces(1.23e-7)).toBe(9);
    expect(decimalPlaces(1e-7)).toBe(7);
  });

  it("aligns values to an exchange step", () => {
    expect(alignToStep(100.127, 0.01, "down")).toBe(100.12);
    expect(alignToStep(100.121, 0.01, "up")).toBe(100.13);
    expect(alignToStep(100.126, 0.01)).toBe(100.13);
  });

  it("rounds negative values consistently with mathematical floor and ceiling", () => {
    expect(alignToStep(-1.21, 0.1, "down")).toBe(-1.3);
    expect(alignToStep(-1.21, 0.1, "up")).toBe(-1.2);
  });

  it("formats with the step's decimal precision", () => {
    expect(formatToStep(1.2, 0.001)).toBe("1.200");
    expect(formatToStep(1.2e-7, 1e-7)).toBe("0.0000001");
  });

  it("rejects invalid step sizes and non-finite values", () => {
    expect(() => alignToStep(1, 0)).toThrow(RangeError);
    expect(() => decimalPlaces(Number.NaN)).toThrow(RangeError);
    expect(() => alignToStep(Number.POSITIVE_INFINITY, 0.01)).toThrow(RangeError);
  });

  it("rejects an invalid runtime rounding mode", () => {
    expect(() => alignToStep(1, 0.01, "sideways" as never)).toThrow(/mode/);
  });
});
