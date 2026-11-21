import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as tradingCore from "./index.js";

interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly private: boolean;
  readonly type: string;
  readonly main: string;
  readonly types: string;
  readonly exports: Record<string, Record<string, string>>;
  readonly files: readonly string[];
  readonly sideEffects: boolean;
  readonly scripts: Record<string, string>;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as PackageManifest;

describe("public API surface", () => {
  const functions = [
    "alignToStep",
    "assertNoDuplicateDetections",
    "assertTimeframe",
    "buildDetectionResult",
    "createDetectionId",
    "createDetectionResult",
    "decimalPlaces",
    "deduplicateDetections",
    "detectionEventKey",
    "formatToStep",
    "getCandleCloseTime",
    "getInstrument",
    "getNextCandleOpenTime",
    "isInstrumentId",
    "isMultipleOfStep",
    "isTimeframe",
    "isTimeframeConfigured",
    "isTimestampAligned",
    "listInstruments",
    "timeframeToMilliseconds",
    "alignTimestampToTimeframe"
  ] as const;

  const values = ["INSTRUMENTS", "INSTRUMENT_IDS", "TIMEFRAMES", "SUPPORTED_TIMEFRAMES"] as const;

  it.each(functions)("exports %s as a function", (name) => {
    expect(typeof tradingCore[name]).toBe("function");
  });

  it.each(values)("exports %s as a runtime value", (name) => {
    expect(tradingCore[name]).toBeDefined();
  });

  it("exposes the typed error classes", () => {
    expect(new tradingCore.ValidationError("INVALID_DETECTION", "x")).toBeInstanceOf(TypeError);
    expect(new tradingCore.BoundsError("INVALID_STEP", "x")).toBeInstanceOf(RangeError);
  });

  it("exposes the timeframe and instrument constants from the blueprint", () => {
    expect([...tradingCore.TIMEFRAMES]).toEqual(["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"]);
    expect([...tradingCore.INSTRUMENT_IDS]).toEqual(["BTCUSDT", "XAUUSDT"]);
    expect([...tradingCore.SUPPORTED_TIMEFRAMES]).toEqual([...tradingCore.TIMEFRAMES]);
  });
});

describe("package configuration", () => {
  it("identifies the workspace package", () => {
    expect(manifest.name).toBe("@trading-master-ai-pro/trading-core");
    expect(manifest.private).toBe(true);
    expect(manifest.type).toBe("module");
  });

  it("publishes an ESM entry point with matching declarations", () => {
    expect(manifest.main).toBe("./dist/index.js");
    expect(manifest.types).toBe("./dist/index.d.ts");
    expect(manifest.exports["."]).toEqual({
      types: "./dist/index.d.ts",
      import: "./dist/index.js"
    });
    expect(manifest.files).toContain("dist");
    expect(manifest.sideEffects).toBe(false);
  });

  it("has zero runtime dependencies so the core stays portable", () => {
    expect(manifest.dependencies).toBeUndefined();
  });

  it("declares build and typecheck scripts", () => {
    expect(manifest.scripts["build"]).toBe("tsc -p tsconfig.build.json");
    expect(manifest.scripts["typecheck"]).toBe("tsc --noEmit -p tsconfig.json");
  });
});
