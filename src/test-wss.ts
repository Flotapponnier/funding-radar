import 'dotenv/config';
import WebSocket from 'ws';

const API_KEY = process.env.MOBULA_API_KEY;
if (!API_KEY) {
  console.error('❌ MOBULA_API_KEY missing in .env');
  process.exit(1);
}

const SYMBOL = process.argv[2] || 'BTC';
const EXCHANGES = 'binance,bybit,hyperliquid,lighter,okx,gate,deribit';
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const TARGET = 3;

const ws = new WebSocket('wss://api.mobula.io');
let snapshotCount = 0;

ws.on('open', () => {
  console.log('✅ WSS connected');
  ws.send(
    JSON.stringify({
      type: 'funding',
      authorization: API_KEY,
      payload: {
        symbol: SYMBOL,
        quote: 'USDT',
        interval: 10,
        exchange: EXCHANGES,
        subscriptionId: `test-${SYMBOL}`,
        subscriptionTracking: 'true',
      },
    })
  );
  console.log(`📡 Subscribed to ${SYMBOL} on ${EXCHANGES}`);
});

ws.on('message', (raw) => {
  let msg: any;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }

  if (msg.event === 'pong') return;
  if (msg.event === 'subscribed') {
    console.log('✅ subscription confirmed:', msg.subscriptionId);
    return;
  }
  if (!msg.queryDetails) {
    console.log('📨 control msg:', JSON.stringify(msg).slice(0, 200));
    return;
  }

  snapshotCount++;
  console.log(`\n--- snapshot #${snapshotCount} ${msg.queryDetails.base} ---`);

  const venues: Array<[string, any]> = [
    ['binance', msg.binanceFundingRate],
    ['bybit', msg.bybitFundingRate],
    ['okx', msg.okxFundingRate],
    ['hyperliquid', msg.hyperliquidFundingRate],
    ['gate', msg.gateFundingRate],
    ['deribit', msg.deribitFundingRate],
    ['lighter', msg.lighterFundingRate],
  ].filter(([, v]) => v) as Array<[string, any]>;

  if (venues.length === 0) {
    console.log('⚠️  no funding data — keys present:', Object.keys(msg));
    return;
  }

  const rows = venues.map(([name, v]) => {
    const rate = Number(v.fundingRate);
    const epochMs = Number(v.epochDurationMs);
    const apr = rate * (YEAR_MS / epochMs) * 100;
    return {
      venue: name,
      rate: rate.toExponential(3),
      epochH: epochMs / 3_600_000,
      apr: apr.toFixed(2) + '%',
    };
  });
  console.table(rows);

  const aprs = rows.map((r) => parseFloat(r.apr));
  const max = Math.max(...aprs);
  const min = Math.min(...aprs);
  const spread = max - min;
  const longVenue = rows[aprs.indexOf(min)]?.venue;
  const shortVenue = rows[aprs.indexOf(max)]?.venue;
  console.log(
    `📊 spread: ${spread.toFixed(2)}% APR  →  long ${longVenue} / short ${shortVenue}`
  );

  if (snapshotCount >= TARGET) {
    console.log(`\n✅ Got ${TARGET} snapshots — closing.`);
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (e) => {
  console.error('❌ WS error:', e.message);
  process.exit(1);
});

ws.on('close', () => console.log('🔌 closed'));

setTimeout(() => {
  console.error('❌ timeout — no snapshot in 30s');
  process.exit(1);
}, 30_000);
