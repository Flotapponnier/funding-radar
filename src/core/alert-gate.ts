import Database from 'better-sqlite3';
import { config } from '../config.js';
import type { DivergenceAlert } from './types.js';

const db = new Database(config.dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS alert_cooldown (
    key TEXT PRIMARY KEY,
    last_ts INTEGER NOT NULL
  );
`);

const getStmt = db.prepare('SELECT last_ts FROM alert_cooldown WHERE key = ?');
const upsertStmt = db.prepare(`
  INSERT INTO alert_cooldown (key, last_ts) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET last_ts = excluded.last_ts
`);

const cooldownMs = config.alerts.cooldownMinutes * 60 * 1000;

function alertKey(a: DivergenceAlert): string {
  const venues = [a.longSide.exchange, a.shortSide.exchange].sort().join('-');
  return `${a.symbol}:${venues}`;
}

export function shouldAlert(a: DivergenceAlert): boolean {
  const k = alertKey(a);
  const row = getStmt.get(k) as { last_ts: number } | undefined;
  if (!row) return true;
  return Date.now() - row.last_ts > cooldownMs;
}

export function recordAlert(a: DivergenceAlert): void {
  upsertStmt.run(alertKey(a), Date.now());
}
