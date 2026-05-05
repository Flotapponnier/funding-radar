import { Telegraf } from 'telegraf';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { annualizeAprPct } from '../core/divergence-engine.js';
import type { DivergenceAlert, FundingSnapshot } from '../core/types.js';

const bot = new Telegraf(config.telegram.token);

let muted = false;
let dynamicThreshold = config.alerts.thresholdAprPct;
const lastSnapshots = new Map<string, FundingSnapshot>();

bot.start((ctx) =>
  ctx.reply(
    `🤖 Funding Radar online.\n\n` +
      `Watched: ${config.watched.symbols.join(', ')}\n` +
      `Across: ${config.watched.exchanges.join(', ')}\n` +
      `Threshold: ${dynamicThreshold}% APR\n\n` +
      `/threshold N — change threshold\n/status — current funding\n/pause • /resume`
  )
);

bot.command('threshold', (ctx) => {
  const arg = ctx.message.text.split(/\s+/)[1];
  if (!arg) return ctx.reply(`Current threshold: ${dynamicThreshold}% APR`);
  const n = Number(arg);
  if (!Number.isFinite(n) || n <= 0) return ctx.reply('Usage: /threshold 30');
  dynamicThreshold = n;
  return ctx.reply(`✅ Threshold set to ${n}% APR`);
});

bot.command('symbols', (ctx) => ctx.reply(config.watched.symbols.join(', ')));

bot.command('status', (ctx) => {
  if (lastSnapshots.size === 0) return ctx.reply('No data yet — give it a few seconds.');
  const lines: string[] = [];
  for (const [sym, snap] of lastSnapshots) {
    lines.push(`*${sym}*`);
    for (const p of snap.points) {
      const apr = annualizeAprPct(p);
      lines.push(`  ${p.exchange.padEnd(11)} ${apr.toFixed(2).padStart(7)}% APR`);
    }
  }
  return ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
});

bot.command('pause', (ctx) => {
  muted = true;
  return ctx.reply('🔇 Alerts paused');
});

bot.command('resume', (ctx) => {
  muted = false;
  return ctx.reply('🔔 Alerts resumed');
});

bot.command('help', (ctx) =>
  ctx.reply(
    `Commands:\n` +
      `/status — current funding APR per venue\n` +
      `/threshold N — set alert threshold (% APR)\n` +
      `/symbols — list watched symbols\n` +
      `/pause • /resume — mute/unmute alerts`
  )
);

export function rememberSnapshot(snap: FundingSnapshot): void {
  lastSnapshots.set(snap.symbol, snap);
}

export function getDynamicThreshold(): number {
  return dynamicThreshold;
}

export async function pushAlert(a: DivergenceAlert): Promise<void> {
  if (muted) return;
  const msg =
    `🚨 *${a.symbol}* funding divergence\n\n` +
    `📈 LONG  on \`${a.longSide.exchange}\`  →  ${a.longSide.aprPct.toFixed(2)}% APR\n` +
    `📉 SHORT on \`${a.shortSide.exchange}\` → ${a.shortSide.aprPct.toFixed(2)}% APR\n\n` +
    `*Spread: ${a.spreadAprPct.toFixed(2)}% APR*\n` +
    `_${new Date(a.ts).toISOString()}_`;
  try {
    await bot.telegram.sendMessage(config.telegram.chatId, msg, {
      parse_mode: 'Markdown',
    });
  } catch (e) {
    logger.error({ err: String(e) }, 'telegram send failed');
  }
}

export function startBot(): void {
  bot.launch();
  logger.info('telegram bot launched');
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
