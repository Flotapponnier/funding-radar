# 📡 funding-radar

> Real-time Telegram bot that detects **funding rate divergences** across 7 perp venues — Binance, Bybit, OKX, Hyperliquid, Lighter, Gate, Deribit. Powered by [Mobula](https://mobula.io)'s WebSocket. Spot cash-and-carry arbs in seconds.

```
🚨 BTC funding divergence

📈 LONG  on `gate`        →  -14.68% APR
📉 SHORT on `hyperliquid` →  +10.96% APR

Spread: 25.64% APR
```

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/) [![Mobula](https://img.shields.io/badge/Powered%20by-Mobula-red)](https://mobula.io)

---

## Why this exists

When the funding rate of a perpetual diverges between two venues, you can **short the high-funding side** and **long the low-funding side** for a delta-neutral, market-neutral yield (*cash-and-carry arbitrage*).

Detecting these divergences in real-time normally means juggling 7 different WebSocket APIs. Mobula gives you all of them in **one stream**, in **one message**, on **one subscription**. This bot is ~250 lines of TypeScript that turn that stream into Telegram pings.

## Stack

- **TypeScript** + `tsx`
- **[Mobula WSS](https://docs.mobula.io/streams/wss-funding)** for funding rates (7 venues, single subscription)
- **[Telegraf](https://github.com/telegraf/telegraf)** for the Telegram bot
- **better-sqlite3** for cooldown state
- **pino** for logs

## Quick start

```bash
git clone https://github.com/Flotapponnier/funding-radar.git
cd funding-radar
npm install
cp .env.example .env
# fill in MOBULA_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
npm run dev
```

### Get the credentials

| Variable | Where |
|---|---|
| `MOBULA_API_KEY` | [mobula.io](https://mobula.io) — Growth plan or higher needed for the WSS funding stream |
| `TELEGRAM_BOT_TOKEN` | DM [@BotFather](https://t.me/BotFather), then `/newbot` |
| `TELEGRAM_CHAT_ID` | Send any message to your bot, then `curl https://api.telegram.org/bot<TOKEN>/getUpdates` and read the `chat.id` |

### Test the WSS without Telegram

Useful to verify your Mobula key + see live funding rates in your terminal:

```bash
npm run test:wss          # BTC by default
npm run test:wss ETH      # any symbol
npm run test:wss HYPE
```

## Telegram commands

| Command | Effect |
|---|---|
| `/start` | welcome message |
| `/status` | current funding APR per venue, per symbol |
| `/threshold 30` | set alert threshold to 30% APR spread |
| `/threshold` | show current threshold |
| `/symbols` | list watched symbols |
| `/pause` / `/resume` | mute / unmute alerts |
| `/help` | command list |

## Configuration

All tuning lives in `.env`:

```
ALERT_THRESHOLD_APR=20         # alert when spread > 20% APR
ALERT_COOLDOWN_MIN=15          # min minutes between alerts on the same pair
WATCHED_SYMBOLS=BTC,ETH,SOL,HYPE
WATCHED_EXCHANGES=binance,bybit,hyperliquid,lighter,okx,gate,deribit
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│        wss://api.mobula.io  (funding stream, 7 venues)        │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
                ┌────────────────────────┐
                │   FundingStream        │   ← reconnect, ping/pong
                └──────────┬─────────────┘
                           ▼
                ┌────────────────────────┐
                │   DivergenceEngine     │   ← APR conversion + spread
                └──────────┬─────────────┘
                           ▼
                ┌────────────────────────┐
                │   AlertGate (SQLite)   │   ← cooldown anti-spam
                └──────────┬─────────────┘
                           ▼
                ┌────────────────────────┐
                │   Telegram bot         │   ← push + commands
                └────────────────────────┘
```

A complete diagram is available at [`docs/overview.excalidraw`](docs/overview.excalidraw) — drag-and-drop into [excalidraw.com](https://excalidraw.com).

## How the math works

A funding rate is paid every "epoch" (1h on Lighter / Hyperliquid, 8h on Binance / Bybit / OKX / Gate). To compare them on the same scale, we annualize:

```
APR (%) = funding_rate_per_epoch × (1 year in ms / epoch_ms) × 100
```

Then we compute `max APR − min APR` across all venues and alert if the spread crosses the threshold.

Example (real values from the repo):

```
Gate BTC:        -0.000134 / 8h    →  -0.000134 × (8766 / 8) × 100  =  -14.68% APR
Hyperliquid BTC:  0.0000125 / 1h   →   0.0000125 × 8766 × 100        =  +10.96% APR

Spread = +10.96 − (-14.68) = 25.64% APR
→ LONG  Gate         (you receive 14.68% APR)
→ SHORT Hyperliquid  (you receive 10.96% APR)
→ Net:  +25.64% APR, delta-neutral on BTC price
```

## Endpoints used

### Mobula WebSocket — `wss://api.mobula.io`

Single subscription returns one message every `interval` seconds containing all requested venues.

**Subscribe payload:**
```json
{
  "type": "funding",
  "authorization": "<MOBULA_API_KEY>",
  "payload": {
    "symbol": "BTC",
    "quote": "USDT",
    "interval": 10,
    "exchange": "binance,bybit,hyperliquid,lighter,okx,gate,deribit",
    "subscriptionId": "funding-BTC",
    "subscriptionTracking": "true"
  }
}
```

**Response shape:**
```json
{
  "queryDetails": { "base": "BTC", "quote": "USDT" },
  "subscriptionId": "funding-BTC",
  "timestamp": 1777986044781,
  "binanceFundingRate":     { "fundingRate": -0.00004626, "epochDurationMs": 28800000, ... },
  "bybitFundingRate":       { "fundingRate":  0.00000173, "epochDurationMs": 28800000, ... },
  "okxFundingRate":         { "fundingRate":  0.0000367,  "epochDurationMs": 28800000, ... },
  "hyperliquidFundingRate": { "fundingRate":  0.0000125,  "epochDurationMs":  3600000, ... },
  "gateFundingRate":        { "fundingRate": -0.000134,   "epochDurationMs": 28800000, ... },
  "lighterFundingRate":     { "fundingRate":  0.000006,   "epochDurationMs":  3600000, ... }
}
```

Docs: <https://docs.mobula.io/streams/wss-funding>

### Telegram Bot API — `https://api.telegram.org/bot<TOKEN>`

| Method | Used for |
|---|---|
| `GET /getUpdates` | one-shot, to grab `chat.id` during setup |
| `POST /sendMessage` | push divergence alerts (handled by Telegraf) |
| Long-polling | receive `/status`, `/threshold`, `/pause`… commands |

Docs: <https://core.telegram.org/bots/api>

## Roadmap

- [ ] Confirmation window (alert only after N consecutive snapshots above threshold)
- [ ] P&L estimation per alert (size × spread − round-trip fees)
- [ ] Open-interest divergence signal
- [ ] Auto-execution on both legs (separate repo)

## Disclaimer

Educational content. Funding-rate arbitrage is **not risk-free** in practice — execution slippage, withdrawal delays, liquidations, and venue-specific risks all apply. Do your own research.

## License

[MIT](LICENSE)
