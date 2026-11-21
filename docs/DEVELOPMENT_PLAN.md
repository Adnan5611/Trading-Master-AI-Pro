# Trading Master AI Pro — Development Plan

**Source:** Blueprint v2.0 ([`BLUEPRINT.md`](BLUEPRINT.md) §§16–20). This plan restates the roadmap, QA gates, and release rules. It does not change Blueprint requirements. **Status: Bootstrap only — no implementation started. Awaiting approval before Phase 0.**

## Phase Roadmap (Blueprint §16)

### Phase 0 — Existing Code Audit
- Day 13–16 code review
- TypeScript errors fix
- Candle validation
- Swing detector tests
- Market structure tests
- Hardcoded confidence removal
- No-lookahead verification
- **Applicability:** these audit tasks apply only where legacy code exists. This repository is intentionally empty, so there is no code to review, fix, or test.
- **Completion:** Clean repository state confirmed; absence of legacy code documented; approved greenfield implementation plan established.
- **Note:** Repository restarted clean (previous files intentionally deleted). No Day 13–16 recovery was attempted. Because no application code or test suite exists, Phase 0 does not report passing tests — TypeScript tooling, test-runner scaffolding and linting begin in Phase 1.

### Phase 1 — Trading Core
- Shared types, instrument configuration, timeframe utilities, price precision, data contracts, common detection result
- **Completion:** Core independent and testable.

### Phase 2 — Market Data
- Binance REST + WebSocket adapters, symbol metadata, candle sync, CSV importer, reconnection/recovery
- **Completion:** BTCUSDT and XAUUSDT data compatibility verified.

### Phase 3 — SMC Engine
- Swing detection, market structure, BOS, CHoCH, MSS, FVG, IFVG, OB, Breaker, Mitigation, Liquidity, Premium/Discount
- **Completion:** Each module has tests and documented rules.

### Phase 4 — Price Action Engine
- Candlestick + chart patterns, validation, scoring
- **Completion:** Independent tested engine.

### Phase 5 — Volume and Advanced Engines
- Volume, Volume Profile, Order Flow, Volatility, Session
- **Completion:** Data availability and calculation accuracy verified.

### Phase 6 — Decision System
- Risk Engine, Confluence Engine, Signal Engine
- **Completion:** Deterministic signals with evidence and risk checks.

### Phase 7 — Backtesting and Paper Trading
- Historical replay, fees/slippage, performance reports, paper positions
- **Completion:** Reproducible test results.

### Phase 8 — PC Desktop App
- Dashboard, charts, signals, settings, backtesting interface
- **Completion:** Installable PC build.

### Phase 9 — Android App
- Mobile dashboard, signals, alerts, shared Trading Core integration
- **Completion:** Installable Android build.

### Phase 10 — Final Validation
- Integration + performance tests, security review, data recovery tests, paper-trading observation
- **Completion:** Release candidate.

## Quality Assurance (Blueprint §17)

Every module: unit tests, edge-case tests, invalid-data tests, historical-replay tests, integration tests.

Required checks:
- No duplicate signals for same event
- No future data leakage
- No invalid candle acceptance
- No arbitrary confidence values
- No position sizing without valid instrument metadata
- No execution when risk checks fail
- No silent API failure
- No false live-data status when feed is disconnected

## Release Rules (Blueprint §18)

v1.0 release candidate only when:
1. BTCUSDT data verified
2. XAUUSDT data verified
3. Candle validation passes
4. Core engine tests pass
5. Risk Engine tests pass
6. Backtest results reproducible
7. Paper trading works correctly
8. Desktop app stable
9. Android app stable
10. Security review complete

## Out of Scope for Initial Release (Blueprint §19)

Fully automated live trading, multiple exchanges/brokers, cloud AI assistant, social/copy trading, cross-exchange portfolio management, paid news intelligence, advanced ML prediction. These must not delay the initial release.

## Final Principles (Blueprint §20)

1. Accuracy over feature quantity. 2. Tested rules over assumptions. 3. Data quality over visuals. 4. Risk before signals. 5. Independent engines. 6. Shared Core. 7. No fake confidence. 8. No live trading without explicit activation. 9. Every detection has evidence. 10. Every important calculation is testable.

## Workflow Rules

- Feature/phase branches; never push directly to `main`; never force-push or delete branches.
- PR per completed phase with summary, changed files, test results, known limitations.
- Preserve history and commits.
- TypeScript; Trading Core independent of Express/frontends; modular engines; providers separate from logic.
- Env-based config; never commit secrets; live disabled by default; never place real trades in dev/test.
- No profitability claims without reliable backtest evidence.
- **Stop after bootstrap; await approval before Phase 0 implementation.**
