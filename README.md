# 📡 funding-radar

> Real-time Telegram bot that detects **funding rate divergences** across 7 perp venues — Binance, Bybit, OKX, Hyperliquid, Lighter, Gate, Deribit. Powered by [Mobula](https://mobula.io)'s WebSocket. Spot cash-and-carry arbs in seconds.

```
🚨 BTC funding divergence

📈 LONG  on `hyperliquid` →  8.74% APR
📉 SHORT on `lighter`     → 84.10% APR

Spread: 75.36% APR
```

---

## Why this exists

When the funding rate for a perp diverges between two venues, you can **short the high-funding side** and **long the low-funding side** for a delta-neutral, market-neutral yield (a.k.a. *cash-and-carry*).

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
| `TELEGRAM_CHAT_ID` | Send any message to your bot, then `curl https://api.telegram.org/bot<TOKEN>/getUpdates` |

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

All tuning is in `.env`:

```
ALERT_THRESHOLD_APR=20         # alert when spread > 20% APR
ALERT_COOLDOWN_MIN=15          # min minutes between alerts on the same pair
WATCHED_SYMBOLS=BTC,ETH,SOL,HYPE
WATCHED_EXCHANGES=binance,bybit,hyperliquid,lighter,okx
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

## How the math works

A funding rate is paid every "epoch" (1h on Lighter / Hyperliquid, 8h on Binance / Bybit / OKX / Gate). To compare them on the same scale, we annualize:

```
APR (%) = funding_rate_per_epoch × (1 year in ms / epoch_ms) × 100
```

Then we just compute `max APR − min APR` across all venues and alert if the spread crosses the threshold.

## Roadmap

- [ ] Confirmation window (alert only after N consecutive snapshots above threshold)
- [ ] P&L estimation per alert (size × spread − round-trip fees)
- [ ] Open-interest divergence signal
- [ ] Auto-execution on both legs (a separate repo — coming soon)

## Disclaimer

Educational content. Funding-rate arbitrage is **not risk-free** in practice — execution slippage, withdrawal delays, liquidations, and venue-specific risks all apply. Do your own research.

## License

MIT
