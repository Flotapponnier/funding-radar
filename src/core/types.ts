export type Exchange =
  | 'binance'
  | 'bybit'
  | 'okx'
  | 'hyperliquid'
  | 'gate'
  | 'deribit'
  | 'lighter';

export type FundingPoint = {
  exchange: Exchange;
  symbol: string;
  fundingRate: number;
  epochDurationMs: number;
  fundingTime: number;
  markPrice?: number;
};

export type FundingSnapshot = {
  symbol: string;
  ts: number;
  points: FundingPoint[];
};

export type DivergenceAlert = {
  symbol: string;
  longSide: { exchange: Exchange; aprPct: number };
  shortSide: { exchange: Exchange; aprPct: number };
  spreadAprPct: number;
  ts: number;
};
