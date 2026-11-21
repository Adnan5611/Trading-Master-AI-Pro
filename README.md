# Trading Master AI Pro

**Rule-Based Trading Analysis & Signal Platform — v1.0 (Bootstrap)**

Modular, reliable, explainable, and testable trading analysis platform for **BTCUSDT** and **XAUUSDT**, running on **Windows PC Desktop + Android** with a shared **TypeScript** Trading Core.

> **Safety:** Version 1.0 supports **analysis, signals, backtesting, and paper trading only**. **Live order execution is disabled by default** and remains a future optional feature. No real trades are placed by this codebase. Never commit API keys, secrets, or tokens.

## Source of Truth

- **Blueprint v2.0:** [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) — complete supplied specification, preserved without silent changes.
- **Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Development Plan:** [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)

If Blueprint and code ever conflict, stop and request clarification — do not invent requirements.

## Scope (v1.0)

- **Instruments:** BTCUSDT (Binance USDⓈ-M Futures), XAUUSDT (Binance TradFi Perpetual)
  - XAUUSDT is **not** traditional broker XAUUSD. It is a USDT-settled perpetual; funding, schedule, mark price, tick size, and contract specs are handled separately and verified from exchange metadata at startup.
- **Timeframes:** 1m, 5m, 15m, 30m, 1h, 2h, 4h, 1d (only those supported per instrument)
- **Modes:** Market analysis, Buy/Sell/Wait signals, Entry/SL/TP suggestions, backtesting, paper trading, alerts/notifications
- **Data:** Binance public market data (REST + WebSocket). Public endpoints generally need no API key. Private/live access is backend-only; withdrawal permission is never enabled.

## Architecture at a Glance

```
Market Data Provider → Data Adapter → Data Validation → Normalized Data
  → Trading Core → Analysis Engines → Validators → Scorers
  → Confluence Engine → Risk Engine → Signal Engine → Output
  → Desktop App / Android App
```

- **Trading Core** is framework-independent (no Express/frontend imports) and shared by PC + Android.
- **Analysis engines** (SMC, Price Action, Volume, Volume Profile, Order Flow, Volatility, Session) each follow **Detector → Validator → Scorer**, as specified in Blueprint Section 5. No arbitrary hardcoded confidence values.
- **Decision engines have separate responsibilities** (Blueprint Sections 6–8) and are not Detector/Validator/Scorer clones: the **Risk Engine** (§6) calculates sizing, stops and limits and blocks invalid trade suggestions independently of signal generation; the **Confluence Engine** (§7) combines available engine results using documented, configurable rules and always shows contributing factors (score is not probability; missing data is not zero; no double-counting); the **Signal Engine** (§8) emits `BUY`/`SELL`/`WAIT`/`NO SIGNAL` with evidence, invalidation, expiry and data-quality status only after required data and risk validations pass.
- **Data providers** are separate from trading logic.
- **Critical rules:** strict candle validation, no look-ahead bias (closed vs. forming candles distinguished; swings confirmed only after required right-side candles close), no invalid candles into engines.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for layers, data flow, and security.

## Repository Status — Bootstrap Only

This commit contains **documentation only** (README, Blueprint, Architecture, Development Plan, `.gitignore`). **No trading engines, no data adapters, no dummy/placeholder logic** have been added yet. Implementation starts only after approval of the Phase 0 plan.

## Development Roadmap (Summary)

| Phase | Focus | Completion Gate |
|---|---|---|
| 0 | Existing code audit (clean repo — confirm empty) | Foundation passes tests |
| 1 | Trading Core | Core independent & testable |
| 2 | Market Data (Binance REST/WS) | BTCUSDT/XAUUSDT verified |
| 3 | SMC Engine | Each module tested & documented |
| 4 | Price Action Engine | Independent tested engine |
| 5 | Volume & Advanced Engines | Accuracy verified |
| 6 | Decision System (Risk/Confluence/Signal) | Deterministic signals + evidence |
| 7 | Backtesting & Paper Trading | Reproducible results |
| 8 | PC Desktop App | Installable build |
| 9 | Android App | Installable build |
| 10 | Final Validation | Release candidate |

Full detail: [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)

## Getting Started

> No application code exists yet — there is nothing to run. Setup instructions will be added with Phase 1 scaffolding (TypeScript toolchain, test runner, linting).

1. Read [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) end-to-end.
2. Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md).
3. Wait for Phase 0 approval before implementing.

## Security

- Secrets stay backend-only; never embed keys in desktop/Android frontends.
- Live trading default **off**; withdrawal permission **never** enabled.
- Never log keys. Respect rate limits. WebSocket reconnect + REST recovery required.
- Use environment variables for configuration; never commit secrets (see `.gitignore`).

## Principles

1. Accuracy over feature quantity. 2. Tested rules over assumptions. 3. Data quality over visuals. 4. Risk before signals. 5. Independent engines. 6. Shared Core. 7. No fake confidence. 8. No live trading without explicit activation. 9. Every detection has evidence. 10. Every important calculation is testable.

**Final Objective:** A modular, reliable, explainable, testable platform for BTCUSDT/XAUUSDT on PC + Android with clean architecture for future expansion.
