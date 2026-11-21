import { describe, expect, it } from "vitest";
import { alignToStep, decimalPlaces, formatToStep } from "./precision.js";

describe("price precision utilities", () => {
  it("counts decimal places including small decimal increments", () => {
    expect(decimalPlaces(0.01)).toBe(2);
    expect(decimalPlaces(0.0001)).toBe(4);
  });

  it("aligns values to an exchange step", () => {
    expect(alignToStep(100.127, 0.01, "down")).toBe(100.12);
    expect(alignToStep(100.121, 0.01, "up")).toBe(100.13);
    expect(alignToStep(100.126, 0.01)).toBe(100.13);
  });

  it("formats with the step's decimal precision", () => {
    expect(formatToStep(1.2, 0.001)).toBe("1.200");
  });

  it("rejects invalid step sizes", () => {
    expect(() => alignToStep(1, 0)).toThrow(RangeError);
  });
});
