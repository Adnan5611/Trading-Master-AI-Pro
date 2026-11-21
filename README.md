# Trading Master AI Pro

**Rule-Based Trading Analysis & Signal Platform — active development**

Trading Master AI Pro is a modular TypeScript platform for market analysis, explainable signals, historical backtesting, and paper trading. The initial market-data venue is **Binance derivatives**. The initial instruments are **BTCUSDT** and **XAUUSDT**, with independently verified contract identities.

> **Safety:** This is an analysis and research platform. Live order execution is not implemented and must remain disabled. Public market-data work does not require API keys or trading permissions.

## Source of Truth

- **Blueprint v2.0:** [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md)
- **Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Development Plan:** [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)
- **Phase 2.2 WebSocket notes:** [`docs/PHASE_2_2_WEBSOCKET.md`](docs/PHASE_2_2_WEBSOCKET.md)

## Verified Initial Market Scope

| Instrument | Binance USDⓈ-M contract | Product classification |
|---|---|---|
| BTCUSDT | `PERPETUAL` | `COIN / Crypto` |
| XAUUSDT | `TRADIFI_PERPETUAL` | `COMMODITY / TradFi` |

These contracts are not interchangeable. Gold requires its own continuous-kline stream and commodity-session awareness. Never silently substitute another symbol or fabricate data.

### Configured timeframes

`1m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, and `1d`.

These are configured candidate intervals. Each instrument's availability must be checked against the exchange before enabling a feed.

## Current Repository Status

- **Phase 1 — Trading Core:** implemented.
- **Phase 2.1 — Product metadata:** verifier and commodity schedule parser are implemented; product identity was checked against live Binance metadata.
- **Phase 2.2 — WebSocket adapter:** first implementation is in review. It routes BTCUSDT symbol klines and XAUUSDT `TRADIFI_PERPETUAL` continuous klines, parses commodity session updates, normalizes candles, and exposes a computed stale-feed health state.
- **Not yet complete:** live WebSocket runtime validation, reconnect/backfill/reconciliation, full data-quality orchestration, and CSV import.
- **Analysis engines and desktop/Android apps:** not yet implemented.

## Verification

Run locally:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm audit --audit-level=low
```

Mocked tests do not prove live exchange connectivity. Report only test and runtime results actually observed for the relevant commit.

## Architecture

```
Binance REST history + WebSocket live streams
  → product-specific adapters
  → normalized market data + quality checks
  → shared Trading Core
  → independent analysis engines
  → Risk + Confluence + Signal
  → desktop / Android apps
```

## Security and Trading Safety

- Use public market-data endpoints only for Phase 2.
- Do not request API keys, private account access, or trading permissions.
- Never enable withdrawal permission.
- Never show a disconnected or stale feed as LIVE.
- Never represent order-book liquidity as executed volume.
- Never claim profitability or guaranteed accuracy without reproducible evidence.

## Development Roadmap

| Phase | Focus | Status |
|---|---|---|
| 0 | Repository baseline | Completed |
| 1 | Trading Core | Implemented |
| 2 | Binance derivatives market data | In progress |
| 3 | SMC Engine | Not started |
| 4 | Price Action Engine | Not started |
| 5 | Volume and advanced engines | Not started |
| 6 | Risk, Confluence, Signal | Not started |
| 7 | Backtesting and Paper Trading | Not started |
| 8 | PC Desktop App | Not started |
| 9 | Android App | Not started |
| 10 | Final Validation | Not started |

