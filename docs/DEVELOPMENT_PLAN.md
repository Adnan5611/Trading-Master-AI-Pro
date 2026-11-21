# Trading Master AI Pro — Development Plan

**Source:** Blueprint v2.0 ([`BLUEPRINT.md`](BLUEPRINT.md) §§16–20). This document records implementation status and phase gates; it does not silently change the Blueprint requirements.

**Current status:** Phase 0 baseline and Phase 1 Trading Core implementation are present. Phase 2 — Binance derivatives market data — is in progress with an initial REST adapter scaffold. Live order execution remains out of scope and disabled.

## Phase Status

| Phase | Status | Evidence / next gate |
|---|---|---|
| 0 — Repository baseline and audit | Completed | Initial repository baseline established; no legacy implementation was assumed |
| 1 — Trading Core | Implemented | Shared contracts, instrument definitions, timeframe and precision helpers, detection validation/IDs, and tests are in the repository |
| 2 — Market Data | In progress | Initial REST client, kline normalizer/validator, and unit tests added; product metadata verification and CI remain mandatory gates |
| 3 — SMC Engine | Not started | Each detector/validator/scorer has measurable rules and tests |
| 4 — Price Action Engine | Not started | Independent patterns, validation, and tests |
| 5 — Volume and Advanced Engines | Not started | Source availability and calculation accuracy verified |
| 6 — Decision System | Not started | Deterministic Risk, Confluence, and Signal outputs with evidence |
| 7 — Backtesting and Paper Trading | Not started | Reproducible replay including fees, slippage, and applicable funding |
| 8 — PC Desktop App | Not started | Stable installable build |
| 9 — Android App | Not started | Stable installable build |
| 10 — Final Validation | Not started | Integration, performance, security, recovery, and paper-trading review |

Do not mark a phase complete because files or folders exist. Completion requires its tests and acceptance criteria to pass.

## Phase 0 — Repository Baseline and Audit

- Confirm repository identity, default branch, existing code, package scripts, and current history.
- Preserve existing commits; do not delete or rewrite history.
- Record that the repository was restarted as a clean baseline before Phase 1 implementation.
- Do not claim legacy-code fixes or tests for code that did not exist at that baseline.

**Status:** Completed as the initial repository baseline.

## Phase 1 — Trading Core

Implemented scope includes:
- Shared instrument, timeframe, candle, metadata, and detection contracts.
- Static instrument configuration for BTCUSDT and XAUUSDT.
- Timeframe and timestamp utilities.
- Price precision helpers.
- Detection validation, evidence validation, deterministic IDs, and duplicate detection.
- Unit tests for the Trading Core contracts and utilities.

**Status:** Implementation is present. Re-run the repository verification commands and inspect the current GitHub Actions result before relying on test status for a release or starting an integration that depends on it.

**Completion gate:** Core remains framework-independent, typechecks, tests pass, and build succeeds.

## Phase 2 — Binance Derivatives Market Data

### Critical instrument/product rule

The initial identifiers are BTCUSDT and XAUUSDT, but they must not be assumed to be the same Binance contract product:

- BTCUSDT is currently modelled as Binance USDⓈ-M Futures.
- XAUUSDT is currently modelled in the code as Binance TradFi Perpetual.
- XAUUSDT must not be assumed to be available through the same USDⓈ-M endpoints or stream family as BTCUSDT.
- Verify product availability, symbol status, endpoint family, intervals, trading schedule, contract specifications, and market-data fields against the correct official Binance metadata before enabling an instrument.
- If the selected product is unavailable through the supported API or for the applicable access region, return an explicit unsupported/unavailable state. Do not substitute another symbol or generate synthetic live data.

### Current implementation snapshot (initial Phase 2 increment)

- Added a separate `@trading-master-ai-pro/market-data` workspace package.
- Added public REST methods for ticker price, klines, and symbol metadata using the USDⓈ-M REST base URL.
- Added strict input checks, numeric parsing, OHLC validation, duplicate/order checks, and candle closed-state calculation.
- Added mocked unit tests for successful parsing and invalid responses.
- The client does not use API keys and contains no order-placement method.
- Live CI passed after the workspace lockfile was synchronized (123 tests, build, typecheck, audit).\n- Live Binance USDⓈ-M `/fapi/v1/exchangeInfo` verified BTCUSDT as `PERPETUAL` / `COIN` / `Crypto`, and XAUUSDT as `TRADIFI_PERPETUAL` / `COMMODITY` / `TradFi`; both report `TRADING` and USDT quote/margin assets.\n- Live ticker, `/fapi/v1/klines`, and `/fapi/v1/continuousKlines` requests succeeded for both symbols. For continuous klines, BTCUSDT uses `PERPETUAL`; XAUUSDT uses `TRADIFI_PERPETUAL`.\n- Exchange filters observed: BTCUSDT tickSize `0.10`, LOT_SIZE stepSize `0.001`, MIN_NOTIONAL `50`; XAUUSDT tickSize `0.01`, LOT_SIZE stepSize `0.001`, MIN_NOTIONAL `5`. These are live observations and must be refreshed at runtime, not hardcoded.\n- Added `verifyInstrumentMetadata()` to enforce each instrument's expected contract identity and extract tick/step size from exchange filters.\n- Added `getTradingSchedule()` to validate and return Binance commodity sessions (`REGULAR` / `NO_TRADING`) for XAU session awareness.\n- The official Futures WebSocket documentation describes both symbol kline and contract-specific continuous-kline streams, including `tradifi_perpetual`; the live WebSocket connection itself remains to be integration-tested in Module 2.3.\n- Added mocked tests for contract identity, metadata mismatch rejection, commodity schedule parsing, and invalid session rejection.

### Module 2.1 — Exchange/Product Metadata

**Verified product map (live Binance USDⓈ-M metadata):**

| Instrument | Contract type | Status | Underlying | Quote / margin | Tick size | LOT_SIZE step | Minimum notional |
|---|---|---|---|---|---:|---:|---:|
| BTCUSDT | `PERPETUAL` | `TRADING` | `COIN` / `Crypto` | USDT / USDT | 0.10 | 0.001 | 50 USDT |
| XAUUSDT | `TRADIFI_PERPETUAL` | `TRADING` | `COMMODITY` / `TradFi` | USDT / USDT | 0.01 | 0.001 | 5 USDT |

- The runtime metadata verifier enforces these instrument-specific contract identities and reads filters from Binance; filter values are not to be hardcoded.
- Live ticker, symbol klines, and continuous-contract klines were successfully queried for both instruments. Continuous contract selectors are `BTCUSDT + PERPETUAL` and `XAUUSDT + TRADIFI_PERPETUAL`.
- Binance exposes a commodity trading schedule for TradFi products. The schedule must be fetched and interpreted at runtime; do not assume that a TradFi commodity has uninterrupted 24/7 price updates just because the perpetual contract is available.
- Official stream documentation lists `tradifi_perpetual` as a valid continuous-kline contract type. Actual WebSocket connectivity, session behavior, reconnects, and stale-data handling are still pending.

**Gate:** Product identity and REST endpoint compatibility verified. Full Phase 2.1 completion still requires schedule integration tests and runtime metadata refresh/health handling.

### Module 2.2 — REST Market-Data Adapter

- Implement product-specific REST clients.
- Fetch historical klines/candles and current market data where supported.
- Respect pagination, request weights, rate limits, retries, and timeouts.
- Parse exchange numeric strings safely.
- Keep venue/product identifiers and source timestamps with every response.

**Gate:** Deterministic tests using recorded fixtures; integration checks against official endpoints; no silent API failures.

### Module 2.3 — WebSocket Market-Data Adapter

- Subscribe to supported live trade, kline, and order-book streams where the product provides them.
- Keep stream routing product-specific.
- Validate incoming event types, symbols, and timestamps.
- Track connection state, heartbeat/last-event time, and stale-feed state.

**Gate:** Valid stream events are normalized; malformed, unexpected, or stale events cannot be presented as live.

### Module 2.4 — Candle Normalizer

- Normalize open, high, low, close, volume, open time, close time, trade count, and supported taker-volume fields.
- Preserve source/product and event/receive timestamps.
- Distinguish closed candles from the currently forming candle.
- Convert all internal timestamps to UTC epoch milliseconds.

**Gate:** REST and WebSocket fixtures produce the same normalized candle contract.

### Module 2.5 — Data Quality Validator

- Validate OHLC relationships and non-negative volume.
- Detect duplicates, missing intervals, out-of-order events, and timestamp inconsistencies.
- Reject invalid candles before they reach Trading Core or any analysis engine.
- Do not fill missing market values with invented prices or volume.

**Gate:** Unit, edge-case, and replay tests prove invalid data is rejected and gaps are visible.

### Module 2.6 — Synchronization and Recovery

- Bootstrap history through REST before declaring a feed ready.
- Reconnect WebSockets with bounded backoff.
- Detect event gaps and stale feeds.
- Recover missing candle ranges through the correct REST endpoint.
- Reconcile REST and WebSocket data without duplicate candles.
- Expose explicit connection/data-quality states to consumers.

**Gate:** Simulated disconnects recover without hidden gaps; stale/disconnected data is never labelled LIVE.

### Module 2.7 — Historical CSV Importer

- Define a versioned CSV schema.
- Validate symbol, product, timeframe, timestamps, OHLCV, and ordering.
- Reject malformed rows and report import errors.
- Preserve source provenance and avoid duplicate records.

**Gate:** Valid fixtures import deterministically; invalid fixtures produce actionable errors.

### Phase 2 final acceptance checklist

- [ ] BTCUSDT product and endpoint compatibility verified.
- [ ] XAUUSDT product and endpoint compatibility verified independently.
- [ ] Contract metadata comes from the exchange, not hardcoded assumptions.
- [ ] Supported timeframes verified per instrument.
- [ ] Historical REST candles normalize correctly.
- [ ] WebSocket updates normalize correctly.
- [ ] REST and WebSocket candles reconcile correctly.
- [ ] Invalid, duplicate, missing, and out-of-order data are handled explicitly.
- [ ] Disconnect/reconnect and REST recovery tests pass.
- [ ] CSV import tests pass.
- [ ] No API secrets or trading permissions are required for public market-data work.
- [ ] Typecheck, tests, build, and dependency audit pass.

## Phase 3 — SMC Engine

- Swing High/Low detection with confirmed right-side candles.
- Market structure, BOS, CHoCH, and MSS.
- FVG, IFVG, Order Block, Breaker, and Mitigation.
- Liquidity pools, equal highs/lows, liquidity grabs, Premium/Discount.
- Define measurable detection, validation, invalidation, and evidence rules before implementation.

**Gate:** Each module has independent tests, replay fixtures, and documented definitions. No look-ahead bias.

## Phase 4 — Price Action Engine

- Candlestick and chart patterns independent from SMC.
- Define body/wick ratios, size thresholds, trend context, confirmation, and invalidation.
- Keep detections explainable and reproducible.

**Gate:** Independent pattern tests and historical replay pass.

## Phase 5 — Volume and Advanced Engines

- Volume and relative volume.
- Volume Profile (clearly label candle-estimated vs trade-based calculations).
- Order Flow using actual available trade/bid-ask data.
- Volatility and session analysis.
- Preserve data source and units; missing data returns unavailable rather than a fabricated value.

**Gate:** Data availability and calculation accuracy are verified for each instrument/product.

## Phase 6 — Decision System

- Risk Engine independently validates stops, sizing, exposure, and limits.
- Confluence Engine combines available evidence without double-counting.
- Signal Engine emits a result only after data-quality and risk checks.
- Scores are not probabilities or guaranteed win rates.

**Gate:** Deterministic BUY/SELL/WAIT/NO SIGNAL outputs with evidence, invalidation, timestamps, and risk status.

## Phase 7 — Backtesting and Paper Trading

- Historical replay and multi-timeframe handling.
- Fees, slippage, and applicable funding costs.
- Equity curve, drawdown, expectancy, profit factor, and trade journal.
- Paper positions use virtual balances only; no real orders.

**Gate:** Reproducible results with out-of-sample and walk-forward checks. No profitability guarantee.

## Phase 8 — PC Desktop App

- Dashboard, charts, instrument/timeframe selection, engine evidence, signals, risk, backtesting, paper trading, and settings.

**Gate:** Stable installable PC build.

## Phase 9 — Android App

- Mobile dashboard, charts, signals, evidence, alerts, and settings.
- Consume the same shared Trading Core contracts.

**Gate:** Stable installable Android build.

## Phase 10 — Final Validation

- Integration and performance tests.
- Security and dependency review.
- Data-gap/recovery tests.
- Extended paper-trading observation.
- Release documentation and known limitations.

**Gate:** Release candidate only after every required check is evidenced.

## Quality Assurance (Blueprint §17)

Every module must include:
- Unit tests.
- Edge-case and invalid-data tests.
- Historical replay tests where applicable.
- Integration tests at module boundaries.

Required system checks:
- No duplicate detections/signals for the same event.
- No future-data leakage.
- No invalid candle acceptance.
- No arbitrary confidence or probability claims.
- No sizing without verified instrument metadata.
- No execution when risk checks fail.
- No silent API failure.
- No false LIVE status when disconnected or stale.

## Release Rules (Blueprint §18)

Do not release v1.0 until:
1. BTCUSDT data is verified.
2. XAUUSDT data is verified or explicitly excluded with a documented reason and approved scope change.
3. Candle validation passes.
4. Core and engine tests pass.
5. Risk Engine tests pass.
6. Backtests are reproducible.
7. Paper trading works correctly.
8. Desktop and Android builds are stable.
9. Security review is complete.

## Workflow Rules

- Work on feature/phase branches; never push directly to `main`.
- Open a Pull Request for each reviewable change/phase.
- Include summary, changed files, tests actually run, CI result, and known limitations.
- Do not force-push or rewrite history.
- Preserve existing commits.
- Keep secrets out of source control.
- Live execution stays disabled; development and tests must not place real trades.
- Do not claim profitability without reliable, reproducible evidence.
- Stop at each phase gate and review the result before beginning the next phase.
