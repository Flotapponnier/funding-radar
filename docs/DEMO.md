# 🎬 Demo / Presentation guide

How to present `funding-radar` in a video, talk, or live demo.

---

## Visual asset

Open [`overview.excalidraw`](overview.excalidraw) at <https://excalidraw.com> (drag-and-drop). Export to PNG for thumbnail / slide deck.

---

## 60-second elevator pitch

> "Funding rates can diverge between exchanges by 20%, 50%, sometimes 100% APR. The trade is trivial — long the cheap side, short the expensive side, collect the spread, neutral on price. The hard part is *spotting* it across 7 venues in real-time. Mobula has a single WebSocket that streams all 7 in one message. This bot turns that into a Telegram ping. ~250 lines of TypeScript. Repo is public."

---

## Live demo flow (5 minutes)

### 1. Hook (30s)
Open Telegram on screen, scroll past previous alerts:
> *"This ping is worth potentially several thousand dollars per month. Watch."*

### 2. Show the architecture (60s)
Pull up `docs/overview.excalidraw`. Walk through left-to-right:
- 7 exchanges → Mobula WSS → 1 stream
- FundingStream → DivergenceEngine → AlertGate → Telegram

Hammer the **red Mobula box**: "*Without this, you're managing 7 separate APIs.*"

### 3. Run it live (90s)
```bash
cd funding-radar
npm run dev
```
Logs scroll. After ~10s, alerts hit Telegram. Show the phone / desktop notification.

### 4. Show the alert math (60s)
```
🚨 BTC funding divergence
📈 LONG  on gate         →  -14.68% APR
📉 SHORT on hyperliquid  →  +10.96% APR
Spread: 25.64% APR
```
Explain on screen:
- Negative funding on Gate → shorts pay longs → **you long, you receive 14.68%**
- Positive funding on HL → longs pay shorts → **you short, you receive 10.96%**
- Combined: **+25.64% APR, delta-neutral**

### 5. Bot interaction (45s)
In Telegram, type:
- `/status` → shows funding APR per venue, per symbol
- `/threshold 5` → tunable in real-time
- `/pause` then `/resume`

### 6. Wrap (15s)
> "Repo is in the description. v2 will auto-execute the trade on both legs."

---

## Long-form video chapters (40 min YouTube format)

| Time | Section |
|---|---|
| 00:00 | **Hook** — live Telegram alert at +25% APR |
| 01:30 | What's a funding rate? (whiteboard with `docs/overview.excalidraw`) |
| 04:00 | Why Mobula and not Moralis / Birdeye / CoinGecko |
| 05:00 | Project setup |
| 08:00 | Code the `FundingStream` (WebSocket client) — money shot #1 |
| 18:00 | `DivergenceEngine` — APR math |
| 24:00 | `AlertGate` — SQLite cooldown |
| 28:00 | Telegram bot with Telegraf |
| 35:00 | Live demo |
| 38:00 | Wrap + repo + v2 teaser |

---

## What makes this story unique

1. **Mobula is the only data provider** that streams CeFi *and* DeFi perp funding in one WebSocket
2. **Multi-venue** out of the box: Binance, Bybit, OKX, Hyperliquid, Lighter, Gate, Deribit
3. **No spammy refresh** — single subscription, push from server every 10s
4. **Stateless code** — the bot itself is ~250 LOC; almost zero infra

---

## Anticipated comments and answers

> **"Funding arb is risk-free, you're going to be rich."**

No. Risks: execution slippage, fees (~0.20% round-trip × 4 trades), withdrawal delays, liquidation if you under-collateralize, counterparty risk on smaller venues. The bot detects opportunities — execution is a separate problem.

> **"Why TypeScript?"**

Telegraf has the cleanest Telegram SDK. WebSocket lib `ws` is battle-tested. SQLite via `better-sqlite3` for zero-deploy state. Anything else (Python, Go) would work — TS just has the smallest LOC for this shape.

> **"Why not poll the REST endpoints?"**

You could (`/data/perps/market-cefi-funding-rate`), but you'd lose real-time edge. Funding can change between epoch boundaries on some venues; the WSS pushes any update immediately.

> **"Why a Growth plan for the WSS?"**

Mobula gates the funding stream behind paid plans because it's a relatively expensive aggregation product on their side. The REST is on cheaper plans if you can live with polling.
