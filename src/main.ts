import { FundingStream } from './mobula/funding-stream.js';
import { DivergenceEngine } from './core/divergence-engine.js';
import { shouldAlert, recordAlert } from './core/alert-gate.js';
import {
  pushAlert,
  rememberSnapshot,
  startBot,
  getDynamicThreshold,
} from './telegram/bot.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import type { FundingSnapshot, DivergenceAlert } from './core/types.js';

const stream = new FundingStream();
const engine = new DivergenceEngine();

stream.on('snapshot', (snap: FundingSnapshot) => {
  rememberSnapshot(snap);
  config.alerts.thresholdAprPct = getDynamicThreshold();
  engine.onSnapshot(snap);
});

engine.on('alert', (a: DivergenceAlert) => {
  logger.info({ alert: a }, 'divergence detected');
  if (!shouldAlert(a)) {
    logger.info({ symbol: a.symbol }, 'within cooldown — skipped');
    return;
  }
  recordAlert(a);
  void pushAlert(a);
});

startBot();
stream.start();

logger.info(
  {
    symbols: config.watched.symbols,
    exchanges: config.watched.exchanges,
    threshold: config.alerts.thresholdAprPct,
  },
  'funding-radar ready'
);
