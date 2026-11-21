# Trading Master AI Pro — Architecture

**Source:** Blueprint v2.0 ([`BLUEPRINT.md`](BLUEPRINT.md) §§3–4, 12–15). This document describes the target architecture and records implementation status. It must not imply that planned adapters, engines, or applications already exist.

**Implementation status:** Trading Core (Phase 1) is implemented. Binance market-data adapters (Phase 2), analysis/decision engines, and desktop/Android applications remain planned work.

## 1. Data Flow

```
Binance Product Metadata / Market Data
  ↓
Product-specific REST and WebSocket Adapters
  ↓
Metadata Validation + Data Quality Validation
  ↓
Normalized Market Data
  ↓
Shared Trading Core
  ↓
Independent Analysis Engines
  ↓
Engine Validators and Scorers
  ↓
Confluence Engine
  ↓
Risk Engine
  ↓
Signal Engine
  ↓
Signal Output
  ↓
Desktop App / Android App
```

The market-data adapter must be selected by the instrument's actual Binance product type. Do not assume BTCUSDT and XAUUSDT share the same contract, endpoint family, schedule, or metadata.

## 2. Software Layers

### A. Market Data Layer — Phase 2 (planned)

- Product-specific Binance REST adapters — history, exchange/product info, recovery, and synchronization.
- Product-specific Binance WebSocket adapters — supported live price/candle/trade/order-book streams.
- Historical CSV importer.
- Candle normalizer.
- Market metadata manager — symbol status, contract type, settlement/quote assets, tick size, quantity step, price filters, schedule, and product-specific rules.
- Data quality validator — OHLCV rules, timestamps, duplicates, gaps, stale-feed detection, and anti-lookahead boundaries.
- Recovery coordinator — reconnect, detect gaps, fetch missing history, reconcile duplicates, and expose data status.

**Product constraints:**
- BTCUSDT is currently modelled as Binance USDⓈ-M Futures.
- XAUUSDT is currently modelled in Trading Core as Binance TradFi Perpetual.
- These classifications are not interchangeable. XAUUSDT endpoint availability and compatibility must be verified independently against official Binance product metadata before enabling it.
- Unsupported products/symbols must be marked unavailable. No silent symbol substitution or synthetic live data.

### B. Trading Core — Phase 1 (implemented)

- Shared candle, instrument, timeframe, metadata, and detection contracts.
- Instrument configuration for BTCUSDT and XAUUSDT.
- Timeframe and timestamp utilities.
- Price precision utilities.
- Shared detection validation and evidence contracts.
- Deterministic detection identifiers and duplicate-event helpers.

Trading Core must remain framework-independent: no Express, Electron, React, or transport-layer imports.

### C. Analysis Engines — future phases

Each engine follows Detector → Validator → Scorer, with documented and testable rules.

| Engine | Planned scope |
|---|---|
| SMC | Swings, structure, BOS/CHoCH/MSS, OB/Breaker/Mitigation, FVG/IFVG, liquidity, Premium/Discount |
| Price Action | Candlestick and chart patterns with measurable ratios, context, confirmation, and invalidation |
| Volume | Candle volume, relative volume, taker volume where supported |
| Volume Profile | POC/VAH/VAL, HVN/LVN; label estimated candle-based vs trade-based |
| Order Flow | Binance venue-specific trades, bid/ask imbalance, delta, absorption candidates, order-book imbalance |
| Volatility | ATR, true range, expansion/contraction |
| Session | UTC-based sessions using verified product trading schedules |

No engine may invent unavailable inputs. Order-book liquidity is not executed volume; Binance venue flow is not global market flow. No arbitrary hardcoded confidence values.

### D. Decision Engines — future Phase 6

- **Risk Engine:** independently checks stops, position sizing, exposure, limits, fees/funding where relevant, and verified contract metadata. It blocks invalid suggestions.
- **Confluence Engine:** combines available engine evidence using documented configurable rules. Score is not probability; missing data is not zero; duplicate factors are not double-counted.
- **Signal Engine:** emits `BUY | SELL | WAIT | NO SIGNAL` with evidence, invalidation, timestamps, expiry, data-quality status, and risk validation.

### E. Application Layer — future phases

- Backend API; secrets remain backend-only.
- Desktop interface (target: Electron + React + TypeScript).
- Android interface (target: React Native + TypeScript).
- Notifications, settings, and local database.

The UI must show explicit disconnected, stale, unsupported, and degraded states. It must never label stale or disconnected market data as LIVE.

## 3. API and Data Boundaries

- Public market-data access is the Phase 2 target; trading/account permissions are not required for public feeds.
- Use the correct official Binance API family for each verified instrument.
- REST is used for metadata, historical initialization, synchronization, and recovery.
- WebSocket is used for supported live events.
- Respect rate limits, retry policies, and product-specific connection rules.
- Preserve source, product, event timestamp, and receive timestamp.
- Private account access and live order execution are not part of Phase 2.

## 4. Data Quality and Anti-Lookahead

- Validate `High ≥ Open,Close`, `Low ≤ Open,Close`, `High ≥ Low`, and `Volume ≥ 0`.
- Enforce timestamp ordering and candle interval alignment.
- Detect duplicates, gaps, stale feeds, and malformed messages.
- Distinguish closed candles from forming candles.
- Confirm swings only after required right-side candles close.
- Backtests must not use future data for past decisions.
- Keep event time and receive time separate.

## 5. Backtesting and Paper Trading — future Phase 7

- Historical replay, multi-timeframe support, entry/exit and SL/TP simulation.
- Include fees, slippage, and applicable funding assumptions.
- Report equity, drawdown, win rate, profit factor, R multiple, expectancy, and trade history.
- Paper trading uses virtual balances and never places real orders.
- Backtest/paper results are not guarantees of live performance.

## 6. Database

Initial local-first entities:
`instruments`, `candles`, `market_metadata`, `engine_detections`, `signals`, `signal_evidence`, `backtest_runs`, `backtest_trades`, `paper_accounts`, `paper_positions`, `paper_trades`, `user_settings`, and `application_logs`.

SQLite is the initial local-storage option; PostgreSQL may be considered for a future optional cloud-sync service.

## 7. Security and Trading Safety

- No API secrets in desktop/mobile frontends or source control.
- Never log secrets.
- Public market-data work must not request trading permissions.
- Withdrawal permission must never be enabled.
- Live order execution remains unimplemented and disabled.
- Validate all external input and respect exchange rate limits.
- Log errors without leaking credentials.
- Back up local data and protect user settings.

## 8. Target Project Structure

The following is a target, not a claim that all folders currently exist:

```
trading-master-ai-pro/
|-- apps/
|   |-- backend/
|   |-- desktop/
|   |-- mobile/
|-- packages/
|   |-- trading-core/          # Phase 1 implemented
|   |-- market-data/           # Phase 2 planned
|   |-- engine-smc/             # planned
|   |-- engine-price-action/    # planned
|   |-- engine-volume/          # planned
|   |-- engine-volume-profile/  # planned
|   |-- engine-order-flow/      # planned
|   |-- engine-risk/            # planned
|   |-- engine-confluence/      # planned
|   |-- engine-signal/          # planned
|   |-- backtesting/            # planned
|-- docs/
|-- tests/
|-- .env.example
|-- README.md
```

Do not move existing code or create empty placeholder modules merely to match this diagram. Add each package when its phase begins and its interfaces are understood.
