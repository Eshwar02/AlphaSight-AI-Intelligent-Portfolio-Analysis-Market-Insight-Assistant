import type { DailyBriefRow, PortfolioHoldingRow } from "./database";

// ── Market data types ────────────────────────────────────────────────

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  pe: number | null;
  high52: number;
  low52: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  previousClose: number;
  currency: string;
  exchange: string;
}

export interface StockHistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type StockHistory = StockHistoryPoint[];

export interface MACDResult {
  macdLine: number | null;
  signalLine: number | null;
  histogram: number | null;
}

export interface BreakoutZone {
  low: number;
  high: number;
  type: 'bullish' | 'bearish';
}

export interface TechnicalIndicators {
  sma20: number | null;
  sma50: number | null;
  ema20: number | null;
  rsi: number | null;
  macd: MACDResult;
  supportLevels: number[];
  resistanceLevels: number[];
  breakoutZones: BreakoutZone[];
  trend: "bullish" | "bearish" | "neutral";
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
}

export interface StockAnalysis {
  quote: StockQuote;
  history: StockHistory;
  technicals: TechnicalIndicators;
  news: NewsItem[];
  macroRisks: string[];
  rawMaterialRisks: string[];
}

// ── Portfolio types (DB row + computed fields) ───────────────────────

export interface PortfolioHolding extends PortfolioHoldingRow {
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

// ── Daily brief with parsed snapshot ─────────────────────────────────

export interface PortfolioSnapshotItem {
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface PortfolioSnapshot {
  holdings: PortfolioSnapshotItem[];
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
}

export interface DailyBrief extends Omit<DailyBriefRow, "portfolio_snapshot"> {
  portfolio_snapshot: PortfolioSnapshot;
}
