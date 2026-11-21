# Trading Master AI Pro

**Rule-Based Trading Analysis & Signal Platform — active development**

Trading Master AI Pro is a modular TypeScript platform for market analysis, explainable signals, historical backtesting, and paper trading. The initial market-data venue is **Binance derivatives**. The initial instrument identifiers are **BTCUSDT** and **XAUUSDT**, subject to instrument-specific exchange verification.

> **Safety:** The current project is an analysis and research platform. Live order execution is not implemented and must remain disabled. Never commit API keys, secrets, or tokens.

## Source of Truth

- **Blueprint v2.0:** [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md)
- **Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Development Plan:** [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)

If the Blueprint and implementation conflict, stop and resolve the discrepancy before building on it.

## Initial Market Scope

| Instrument | Current project classification | Verification required |
|---|---|---|
| BTCUSDT | Binance USDⓈ-M Futures | Confirm symbol status and contract filters from live exchange metadata |
| XAUUSDT | Currently modelled in code as Binance TradFi Perpetual | Confirm product/API availability, trading schedule, contract rules, and data-stream compatibility before enabling |

**Important:** BTCUSDT and XAUUSDT are both listed in USDⓈ-M exchange metadata, but they are different contract types. BTCUSDT is `PERPETUAL`; XAUUSDT is `TRADIFI_PERPETUAL`. Both live ticker and kline request families returned data in verification. XAUUSDT also requires commodity trading-session awareness. The app must never treat these instruments as interchangeable or use BTC contract rules for gold. unsupported/unavailable; it must not silently substitute another symbol or fabricate data.

### Candidate timeframes in Trading Core

The current shared contract lists: `1m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, and `1d`.

These are **candidate/configured timeframes**, not a claim that every Binance product supports every interval. Phase 2 must verify actual per-instrument support from the relevant exchange API.

## Current Repository Status

- **Phase 1 — Trading Core:** implementation is present on `main`. It includes shared contracts, instrument configuration, timeframe utilities, precision helpers, detection validation, and deterministic detection identifiers.
- **Phase 2 — Market Data:** in progress. An initial public REST adapter package now includes price, kline, and symbol-metadata requests plus candle validation/tests. Product compatibility is not yet approved for either instrument; WebSocket streaming, full metadata/filter validation, synchronization/recovery, and CSV import remain future work.
- **Analysis and decision engines:** SMC, Price Action, Volume, Volume Profile, Order Flow, Risk, Confluence, and Signal engines are not yet implemented.
- **Applications:** desktop and Android user interfaces are not yet implemented.

The repository includes automated scripts for typechecking, tests, build, audit, and verification. Run the checks locally before proposing a change:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm audit --audit-level=low
```

The presence of a test suite does not prove market-data connectivity, signal accuracy, or profitability. Report only test results actually observed in the relevant commit/CI run.

## Architecture at a Glance

```
Binance Product API
  → Product-specific REST / WebSocket adapters
  → Exchange metadata + data-quality validation
  → Normalized market data
  → Shared Trading Core
  → Independent analysis engines
  → Confluence + Risk + Signal decisions
  → Desktop / Android applications
```

- Trading Core stays framework-independent and shared across applications.
- Data adapters are separate from trading logic.
- Each analysis engine must expose evidence and documented rules.
- Closed candles and forming candles must remain distinguishable.
- No look-ahead bias, duplicate detections, invented market data, or arbitrary confidence/probability claims.
- Order-book liquidity must not be represented as executed volume; venue-specific flow must not be described as global market flow.
- Risk validation is required before a trade suggestion can be emitted.

## Development Roadmap

| Phase | Focus | Status / completion gate |
|---|---|---|
| 0 | Repository/code audit | Completed as the initial repository baseline; legacy code was not assumed |
| 1 | Trading Core | Implemented; maintain with automated checks |
| 2 | Binance derivatives market data | In progress: initial REST client and parser added; verify product metadata and run CI before enabling feeds |
| 3 | SMC Engine | Documented rules, independent modules, tests |
| 4 | Price Action Engine | Independent patterns, validation, tests |
| 5 | Volume and advanced engines | Verify source availability and calculation accuracy |
| 6 | Risk, Confluence, Signal | Deterministic decisions with evidence and risk checks |
| 7 | Backtesting and Paper Trading | Reproducible replay including fees, slippage, and applicable funding |
| 8 | PC Desktop App | Stable installable build |
| 9 | Android App | Stable installable build |
| 10 | Final Validation | Integration, performance, security, and paper-trading review |

See [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) for phase gates and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the system design.

## Security and Trading Safety

- Public market-data access should be used for Phase 2; do not request trading permissions.
- Secrets, if ever required for a later optional feature, stay backend-only and outside source control.
- Withdrawal permission must never be enabled.
- Live trading is not part of the current implementation.
- Respect exchange rate limits and terms; handle disconnects and stale data explicitly.
- Never show a disconnected or stale feed as LIVE.
- Never claim profitability or guaranteed accuracy without robust, reproducible evidence.

## Project Principles

1. Accuracy over feature quantity.
2. Tested rules over assumptions.
3. Data quality over visuals.
4. Risk before trade suggestions.
5. Independent, explainable engines.
6. Shared Trading Core.
7. No fake confidence or probability claims.
8. No live execution by default.
9. Every detection has evidence.
10. Every important calculation is testable.
