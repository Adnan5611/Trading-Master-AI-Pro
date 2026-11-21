import { describe, expect, it } from "vitest";
import { BoundsError, ValidationError } from "./errors.js";
import {
  MAX_SUPPORTED_DECIMALS,
  alignToStep,
  decimalPlaces,
  formatToStep,
  isMultipleOfStep
} from "./precision.js";

describe("decimalPlaces", () => {
  it.each([
    [1, 0],
    [10, 0],
    [1000, 0],
    [0.5, 1],
    [0.01, 2],
    [0.001, 3],
    [0.0001, 4],
    [1e-8, 8],
    [5e-7, 7],
    [2.5e-7, 8],
    [1.25e-5, 7],
    [2.5e-6, 7]
  ])("reports %d as %d decimal places", (step, expected) => {
    expect(decimalPlaces(step)).toBe(expected);
  });

  it("treats large exponent-form integers as zero-decimal steps", () => {
    expect(decimalPlaces(1e21)).toBe(0);
  });

  it("rejects zero, negative, non-finite and non-numeric steps", () => {
    for (const invalid of [0, -0.01, Number.NaN, Number.POSITIVE_INFINITY, -0]) {
      expect(() => decimalPlaces(invalid)).toThrow(BoundsError);
    }
    expect(() => decimalPlaces("0.01" as unknown as number)).toThrow(BoundsError);
  });
});

describe("alignToStep", () => {
  it("floors, ceilings and rounds to the exchange increment", () => {
    expect(alignToStep(100.127, 0.01, "down")).toBe(100.12);
    expect(alignToStep(100.121, 0.01, "up")).toBe(100.13);
    expect(alignToStep(100.124, 0.01)).toBe(100.12);
    expect(alignToStep(100.126, 0.01)).toBe(100.13);
  });

  it("leaves already-aligned values untouched", () => {
    expect(alignToStep(100.12, 0.01)).toBe(100.12);
    expect(alignToStep(0, 0.01)).toBe(0);
    expect(alignToStep(42, 1)).toBe(42);
  });

  it("absorbs binary floating point noise", () => {
    expect(alignToStep(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(alignToStep(1.0000000000000002, 1)).toBe(1);
  });

  it("handles sub-microscopic tick sizes without scientific-notation drift", () => {
    expect(alignToStep(0.000000123, 1e-8, "down")).toBe(1.2e-7);
    expect(alignToStep(0.000000126, 1e-8, "up")).toBe(1.3e-7);
    expect(formatToStep(0.000000123, 1e-8)).toBe("0.00000012");
  });

  it("handles quantity steps used by futures contracts", () => {
    expect(alignToStep(0.000123456789, 1e-8, "down")).toBe(0.00012345);
    expect(alignToStep(3.14159, 0.001, "down")).toBe(3.141);
  });

  it("keeps mathematical direction for negative values", () => {
    expect(alignToStep(-1.234, 0.01, "down")).toBe(-1.24);
    expect(alignToStep(-1.234, 0.01, "up")).toBe(-1.23);
    expect(alignToStep(-1.234, 0.01)).toBe(-1.23);
    expect(alignToStep(-0.001, 0.01, "up")).toBe(0);
  });

  it("never returns negative zero", () => {
    expect(Object.is(alignToStep(-0.001, 0.01, "up"), 0)).toBe(true);
    expect(Object.is(alignToStep(-0, 0.01), 0)).toBe(true);
  });

  it("aligns large prices without precision loss at the cent level", () => {
    expect(alignToStep(100_000.006, 0.01)).toBe(100_000.01);
    expect(alignToStep(99_999.994, 0.01, "down")).toBe(99_999.99);
  });

  it("rejects invalid values, steps, modes and over-precise steps", () => {
    expect(() => alignToStep(Number.NaN, 0.01)).toThrow(BoundsError);
    expect(() => alignToStep(Number.POSITIVE_INFINITY, 0.01)).toThrow(BoundsError);
    expect(() => alignToStep(1, 0)).toThrow(BoundsError);
    expect(() => alignToStep(1, -0.01)).toThrow(BoundsError);
    expect(() => alignToStep(1, "0.01" as unknown as number)).toThrow(BoundsError);
    expect(() => alignToStep(1, 1e-16)).toThrow(/beyond 15/);
    expect(() => alignToStep(1, 0.01, "sideways" as unknown as "down")).toThrow(ValidationError);
  });

  it("documents its precision ceiling", () => {
    expect(() => alignToStep(1, 10 ** -MAX_SUPPORTED_DECIMALS)).not.toThrow();
  });
});

describe("isMultipleOfStep", () => {
  it("detects aligned values despite float noise", () => {
    expect(isMultipleOfStep(0.3, 0.1)).toBe(true);
    expect(isMultipleOfStep(0.1 + 0.2, 0.1)).toBe(true);
    expect(isMultipleOfStep(100.12, 0.01)).toBe(true);
    expect(isMultipleOfStep(0, 0.01)).toBe(true);
  });

  it("detects misaligned values", () => {
    expect(isMultipleOfStep(0.25, 0.1)).toBe(false);
    expect(isMultipleOfStep(100.125, 0.01)).toBe(false);
  });

  it("rejects invalid input", () => {
    expect(() => isMultipleOfStep(Number.NaN, 0.01)).toThrow(BoundsError);
    expect(() => isMultipleOfStep(1, 0)).toThrow(BoundsError);
  });
});

describe("formatToStep", () => {
  it("formats with the step's decimal precision", () => {
    expect(formatToStep(1.2, 0.001)).toBe("1.200");
    expect(formatToStep(100_000, 0.01)).toBe("100000.00");
    expect(formatToStep(2.4, 1)).toBe("2");
    expect(formatToStep(0.1 + 0.2, 0.1)).toBe("0.3");
  });

  it("rounds to nearest then formats", () => {
    expect(formatToStep(1.2345, 0.01)).toBe("1.23");
    expect(formatToStep(1.2355, 0.01)).toBe("1.24");
  });
});
