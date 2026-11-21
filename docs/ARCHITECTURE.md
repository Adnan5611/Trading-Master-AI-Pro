# Trading Master AI Pro — Architecture

**Source:** Blueprint v2.0 ([`BLUEPRINT.md`](BLUEPRINT.md) §§3–4, 12–15). This document summarises the target architecture. It does not change Blueprint requirements. No code exists yet — this is a design reference for Phase 1+.

## 1. Data Flow (Blueprint §4.1)

```
Market Data Provider
  ↓
Data Adapter
  ↓
Data Validation Layer
  ↓
Normalized Market Data
  ↓
Trading Core
  ↓
Individual Analysis Engines
  ↓
Engine Validators
  ↓
Engine Scorers
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

## 2. Software Layers (Blueprint §4.2)

### A. Market Data Layer
- Binance REST Adapter — initial history, exchange info, recovery, sync
- Binance WebSocket Adapter — live price/candle/trade/order-book, reconnect + REST recovery on disconnect
- Historical CSV Importer
- Candle Normalizer
- Market Metadata Manager — symbol status, tick size, step size, price filters, contract info, trading rules (verified at startup; never invent data)
- Data Quality Validator — candle rules + anti-lookahead (Blueprint §9)

### B. Trading Core (shared, framework-independent)
- Candle Types
- Instrument Configuration (BTCUSDT, XAUUSDT)
- Timeframe Utilities (1m–1d, per-instrument support)
- Price Precision Utilities
- Event Types
- Shared Detection Results
- Calculation Utilities

> **Constraint:** Trading Core must not import Express or frontend frameworks. Desktop (Electron + React) and Android (React Native) both consume the same Core logic (Blueprint §13).

### C. Analysis Engines (each: Detector → Validator → Scorer)
| Engine | Blueprint § | Notes |
|---|---|---|
| SMC Engine | §5.1 | 17 modules: swings, structure, BOS/CHoCH/MSS, OB/Breaker/Mitigation, FVG/IFVG, liquidity, premium/discount, supply/demand. Subjective rules → measurable thresholds. |
| Price Action Engine | §5.2 | Independent of SMC. Candlestick + chart patterns with ratio/size/context/confirmation/invalidation. |
| Volume Engine | §5.3 | Source + unit preserved per result. |
| Volume Profile Engine | §5.4 | POC/VAH/VAL, HVN/LVN. Candle-only → label "estimated candle-based"; trade-level → trade-based. |
| Order Flow Engine | §5.5 | Binance-venue only; never claim global volume. Missing trade data → `unavailable`. Order-book liquidity ≠ executed volume. |
| Volatility Engine | §5.6 | ATR, true range, expansion/contraction → feeds risk + filtering. |
| Session Engine | §5.7 | UTC handling, configurable sessions. XAUUSDT schedule/maintenance verified; no auto Forex assumptions. |

**No arbitrary hardcoded confidence values** in any engine (Blueprint §5).

### D. Decision Engines
- **Risk Engine** (§6) — independent of signal generation. Risk/trade, sizing, SL/TP, R/R, daily loss, max positions/exposure, consecutive-loss protection, volatility adjustment, fees/funding. Blocks suggestions on invalid SL/qty/specs. Sizing reads instrument specs first.
- **Confluence Engine** (§7) — combines available engines. Score ≠ probability; never display as win-rate/guarantee. Missing data ≠ zero/positive. No double-counting. Contributing factors always shown.
- **Signal Engine** (§8) — outputs `BUY | SELL | WAIT | NO SIGNAL` with instrument, timeframe, direction, entry zone, SL, TPs, R/R, score, evidence, invalidation, timestamps, engine versions, expiry, data-quality status. Only when data + risk validations pass.

### E. Application Layer
- Backend API (secrets backend-only)
- Desktop Interface (Electron + React + TypeScript)
- Android Interface (React Native + TypeScript)
- Notifications, Settings, Local Database (SQLite initially; PostgreSQL optional future cloud sync)

## 3. API & Data (Blueprint §3)

- **Required (Binance public):** exchange info, klines (OHLCV + open/close time + trades where available), current price, historical candles.
- **Optional (verify compatibility first):** aggregate trades, order-book depth, best bid/ask, mark/index price, funding, open interest, taker buy/sell, liquidations.
- **REST** for history/info/recovery/sync; **WebSocket** for live updates. Disconnect → reconnect + REST recovery.
- **Keys:** public data usually keyless. Private/live needs authenticated backend-only access. Withdrawal never enabled. Live default disabled. Never log keys. Revocable by user.
- **Optional external APIs** (News, Economic Calendar, AI explanations, Cloud Sync, Broker) — core engines work without them.

## 4. Data Quality & Anti-Lookahead (Blueprint §9 — critical)

- Candle validation: `High ≥ Open,Close`; `Low ≤ Open,Close`; `High ≥ Low`; `Volume ≥ 0`; ordered timestamps; handle duplicates; detect missing; invalid candles never enter engines.
- Look-ahead prevention: distinguish closed vs. forming candles; swings confirmed only after required right-side candles close; backtests never use future data for past decisions; separate signal vs. confirmation timestamps.

## 5. Backtesting & Paper Trading (Blueprint §§10–11)

- Backtest: replay, multi-timeframe, entry/exit + SL/TP simulation, fees/slippage/funding, equity/drawdown/win-rate/profit-factor/R/expectancy/trade history. In-sample, out-of-sample, walk-forward, sensitivity. Never presented as live guarantee.
- Paper: virtual balance/positions/journal/reports; **never places real orders**; separate module from any future execution.

## 6. Database (Blueprint §12)

Local-first entities: `instruments`, `candles`, `market_metadata`, `engine_detections`, `signals`, `signal_evidence`, `backtest_runs`, `backtest_trades`, `paper_accounts`, `paper_positions`, `paper_trades`, `user_settings`, `application_logs`. SQLite initially; PostgreSQL optional later.

## 7. Security (Blueprint §15)

No secrets in frontends; no secrets in logs; live default off; withdrawal disabled; mandatory input validation; respect rate limits; WebSocket reconnect; DB backup; error logging; secure settings.

## 8. Target Project Structure (Blueprint §14 — future, not yet created)

```
trading-master-ai-pro/
|-- apps/backend/ | desktop/ | mobile/
|-- packages/trading-core/ | market-data/ | engine-*/ | backtesting/
|-- docs/ (BLUEPRINT.md, DATA/SMC/PRICE_ACTION/RISK/API specs, TESTING_PLAN.md)
|-- tests/
|-- .env.example
|-- README.md
```

> Existing code must not be blindly moved without audit; migration is step-by-step. **This bootstrap creates only `docs/` + README + `.gitignore` — no `apps/` or `packages/` yet.**
