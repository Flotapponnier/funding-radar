import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { Exchange, FundingPoint, FundingSnapshot } from '../core/types.js';

type RawFundingEntry = {
  symbol: string;
  fundingTime: number | string;
  fundingRate: number | string;
  epochDurationMs: number | string;
  marketPrice?: number | string;
};

type RawFundingMsg = {
  queryDetails: { base: string; quote: string };
  subscriptionId?: string;
  timestamp: number;
  binanceFundingRate?: RawFundingEntry;
  bybitFundingRate?: RawFundingEntry;
  okxFundingRate?: RawFundingEntry;
  hyperliquidFundingRate?: RawFundingEntry;
  gateFundingRate?: RawFundingEntry;
  deribitFundingRate?: RawFundingEntry;
  lighterFundingRate?: RawFundingEntry;
};

export class FundingStream extends EventEmitter {
  private ws?: WebSocket;
  private reconnectDelay = 1000;
  private pingTimer?: NodeJS.Timeout;
  private closedByUser = false;

  start(): void {
    this.connect();
  }

  stop(): void {
    this.closedByUser = true;
    this.ws?.close();
    if (this.pingTimer) clearInterval(this.pingTimer);
  }

  private connect(): void {
    logger.info('connecting to Mobula WSS...');
    const ws = new WebSocket(config.mobula.wsUrl);
    this.ws = ws;

    ws.on('open', () => {
      logger.info('WSS open — subscribing');
      this.reconnectDelay = 1000;
      this.subscribe();
      this.startPing();
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.event === 'pong') return;
        if (msg.queryDetails) this.handleFundingMessage(msg as RawFundingMsg);
      } catch (e) {
        logger.warn({ err: String(e) }, 'failed to parse WS msg');
      }
    });

    ws.on('close', () => {
      logger.warn('WSS closed');
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (!this.closedByUser) this.scheduleReconnect();
    });

    ws.on('error', (e) => logger.error({ err: String(e) }, 'WSS error'));
  }

  private scheduleReconnect(): void {
    const d = this.reconnectDelay;
    this.reconnectDelay = Math.min(d * 2, 30_000);
    logger.info(`reconnecting in ${d}ms`);
    setTimeout(() => this.connect(), d);
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'ping' }));
      }
    }, 30_000);
  }

  private subscribe(): void {
    const exchanges = config.watched.exchanges.join(',');
    for (const symbol of config.watched.symbols) {
      const payload = {
        type: 'funding',
        authorization: config.mobula.apiKey,
        payload: {
          symbol,
          quote: 'USDT',
          interval: 10,
          exchange: exchanges,
          subscriptionId: `funding-${symbol}`,
          subscriptionTracking: 'true',
        },
      };
      this.ws!.send(JSON.stringify(payload));
      logger.info({ symbol, exchanges }, 'subscribed');
    }
  }

  private handleFundingMessage(msg: RawFundingMsg): void {
    const symbol = msg.queryDetails.base;
    const points: FundingPoint[] = [];

    const pick = (ex: Exchange, raw?: RawFundingEntry): void => {
      if (!raw) return;
      points.push({
        exchange: ex,
        symbol,
        fundingRate: Number(raw.fundingRate),
        epochDurationMs: Number(raw.epochDurationMs),
        fundingTime: Number(raw.fundingTime),
        markPrice: raw.marketPrice !== undefined ? Number(raw.marketPrice) : undefined,
      });
    };

    pick('binance', msg.binanceFundingRate);
    pick('bybit', msg.bybitFundingRate);
    pick('okx', msg.okxFundingRate);
    pick('hyperliquid', msg.hyperliquidFundingRate);
    pick('gate', msg.gateFundingRate);
    pick('deribit', msg.deribitFundingRate);
    pick('lighter', msg.lighterFundingRate);

    if (points.length < 2) return;

    const snapshot: FundingSnapshot = { symbol, ts: msg.timestamp, points };
    this.emit('snapshot', snapshot);
  }
}
