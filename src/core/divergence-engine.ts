import { EventEmitter } from 'node:events';
import { config } from '../config.js';
import type { DivergenceAlert, FundingPoint, FundingSnapshot } from './types.js';

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

export function annualizeAprPct(p: FundingPoint): number {
  if (!p.epochDurationMs) return 0;
  return p.fundingRate * (YEAR_MS / p.epochDurationMs) * 100;
}

export class DivergenceEngine extends EventEmitter {
  onSnapshot = (snap: FundingSnapshot): void => {
    const enriched = snap.points.map((p) => ({ ...p, aprPct: annualizeAprPct(p) }));
    if (enriched.length < 2) return;

    const max = enriched.reduce((a, b) => (b.aprPct > a.aprPct ? b : a));
    const min = enriched.reduce((a, b) => (b.aprPct < a.aprPct ? b : a));

    const spread = max.aprPct - min.aprPct;

    if (spread >= config.alerts.thresholdAprPct) {
      const alert: DivergenceAlert = {
        symbol: snap.symbol,
        longSide: { exchange: min.exchange, aprPct: min.aprPct },
        shortSide: { exchange: max.exchange, aprPct: max.aprPct },
        spreadAprPct: spread,
        ts: snap.ts,
      };
      this.emit('alert', alert);
    }
  };
}
