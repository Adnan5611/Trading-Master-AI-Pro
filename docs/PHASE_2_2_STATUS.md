# Phase 2.2 update — WebSocket adapter

The first public WebSocket adapter increment is implemented on branch `phase2-2/binance-websocket-market-data`.

- BTCUSDT uses `btcusdt@kline_{interval}`.
- XAUUSDT uses `xauusdt_tradifi_perpetual@continuousKline_{interval}`.
- `tradingSession` is subscribed for commodity-session updates.
- Candle payloads are normalized and product identity is validated.
- Feed health distinguishes CONNECTING, LIVE, STALE, OFFLINE, and ERROR.
- The adapter uses injectable socket and clock interfaces for deterministic tests.

**Still pending:** actual live runtime connection test, automatic reconnect, REST backfill, and REST/WebSocket reconciliation. Do not mark Phase 2 complete until these gates and the full CI suite pass.
