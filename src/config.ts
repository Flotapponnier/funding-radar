import 'dotenv/config';

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

export const config = {
  mobula: {
    apiKey: need('MOBULA_API_KEY'),
    wsUrl: 'wss://api.mobula.io',
  },
  telegram: {
    token: need('TELEGRAM_BOT_TOKEN'),
    chatId: need('TELEGRAM_CHAT_ID'),
  },
  alerts: {
    thresholdAprPct: Number(process.env.ALERT_THRESHOLD_APR ?? 20),
    cooldownMinutes: Number(process.env.ALERT_COOLDOWN_MIN ?? 15),
  },
  watched: {
    symbols: (process.env.WATCHED_SYMBOLS ?? 'BTC,ETH,SOL')
      .split(',')
      .map((s) => s.trim().toUpperCase()),
    exchanges: (process.env.WATCHED_EXCHANGES ?? 'binance,bybit,hyperliquid,lighter')
      .split(',')
      .map((s) => s.trim()),
  },
  dbPath: process.env.DB_PATH ?? './bot.db',
};
