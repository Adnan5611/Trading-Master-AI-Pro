# Phase 2.2 — Binance WebSocket Market Data

## Objective

Receive live public market data for the exact verified Binance products and normalize it into the shared candle contract. This is market-data infrastructure only; no private account access, API key, or order placement is included.

## Product-specific stream routing

| Instrument | Contract | Stream pattern |
|---|---|---|
| BTCUSDT | `PERPETUAL` | `btcusdt@kline_{interval}` |
| XAUUSDT | `TRADIFI_PERPETUAL` | `xauusdt_tradifi_perpetual@continuousKline_{interval}` |
| Gold session status | Commodity underlying | `tradingSession` |

The combined stream connection uses Binance's public market endpoint:

`wss://fstream.binance.com/market/stream?streams=...`

The XAUUSDT route must retain the explicit `TRADIFI_PERPETUAL` contract selector. Do not subscribe to a plain XAUUSDT crypto-perpetual stream or silently replace the instrument.

## First implementation

- `BinanceWebSocketClient` builds combined stream URLs for the configured timeframes.
- Incoming symbol and contract identity are checked before a candle is emitted.
- Candles preserve open/close timestamps, OHLC, volume, trade count, taker-buy volume, forming/closed state, receive time, and source.
- Commodity session events are parsed as `REGULAR` or `NO_TRADING`.
- Health reports `CONNECTING`, `LIVE`, `STALE`, `OFFLINE`, or `ERROR`; stale status is computed from the last valid event.
- Socket factory and clock are injectable for deterministic tests.
- Malformed payloads and product mismatches are reported; they are not converted into prices.

## Not yet implemented

- Automatic reconnect with bounded backoff.
- REST bootstrap and missing-candle backfill after disconnect.
- REST/WebSocket candle reconciliation and duplicate/gap tracking.
- Runtime live connection checks against Binance from the deployed app.
- Server-side health broadcasting to the future dashboard.

These remain explicit follow-up gates. A mocked unit test is not proof of a live production feed.

## Acceptance gate

- Typecheck, unit tests, build, and dependency audit pass.
- BTC and XAU events are normalized from their distinct stream payloads.
- Incorrect symbols/contracts, malformed OHLC, invalid timestamps, and unknown session states are rejected.
- A feed is never reported LIVE before the socket opens and a valid event is received; after the stale threshold it reports STALE.
- No API credentials or order execution are introduced.
