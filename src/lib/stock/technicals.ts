import type { StockHistory, TechnicalIndicators } from '@/types/stock';

/**
 * Simple Moving Average
 */
function sma(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

/**
 * Exponential Moving Average
 */
function ema(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = data.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < data.length; i++) {
    emaVal = data[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

/**
 * EMA series for MACD calculation
 */
function emaSeries(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let emaVal = data.slice(0, period).reduce((s, v) => s + v, 0) / period;
  result.push(emaVal);
  for (let i = period; i < data.length; i++) {
    emaVal = data[i] * k + emaVal * (1 - k);
    result.push(emaVal);
  }
  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 * Returns { macdLine, signalLine, histogram }
 */
function calculateMACD(closes: number[]): {
  macdLine: number | null;
  signalLine: number | null;
  histogram: number | null;
} {
  if (closes.length < 35) return { macdLine: null, signalLine: null, histogram: null };

  const ema12Series = emaSeries(closes, 12);
  const ema26Series = emaSeries(closes, 26);

  // Align the two series (ema26 starts later)
  const offset = 26 - 12;
  const macdSeries: number[] = [];
  for (let i = offset; i < ema12Series.length && i - offset < ema26Series.length; i++) {
    macdSeries.push(ema12Series[i] - ema26Series[i - offset]);
  }

  if (macdSeries.length < 9) return { macdLine: null, signalLine: null, histogram: null };

  // Signal line is 9-period EMA of MACD line
  const signalSeries = emaSeries(macdSeries, 9);

  const macdLine = macdSeries[macdSeries.length - 1];
  const signalLine = signalSeries[signalSeries.length - 1];
  const histogram = macdLine - signalLine;

  return {
    macdLine: Math.round(macdLine * 100) / 100,
    signalLine: Math.round(signalLine * 100) / 100,
    histogram: Math.round(histogram * 100) / 100,
  };
}

/**
 * Relative Strength Index (14-period)
 */
function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average
  for (let i = 1; i <= period; i++) {
    const diff = closes[closes.length - period - 1 + i] - closes[closes.length - period - 1 + i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }

  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Find support levels from recent swing lows
 */
function findSupportLevels(history: StockHistory): number[] {
  if (history.length < 20) return [];

  const recent = history.slice(-90);
  const levels: number[] = [];

  // Find local minima (swing lows)
  for (let i = 2; i < recent.length - 2; i++) {
    if (
      recent[i].low < recent[i - 1].low &&
      recent[i].low < recent[i - 2].low &&
      recent[i].low < recent[i + 1].low &&
      recent[i].low < recent[i + 2].low
    ) {
      levels.push(Math.round(recent[i].low * 100) / 100);
    }
  }

  // Deduplicate close levels (within 2% of each other)
  const unique: number[] = [];
  for (const level of levels.sort((a, b) => a - b)) {
    if (unique.length === 0 || Math.abs(level - unique[unique.length - 1]) / unique[unique.length - 1] > 0.02) {
      unique.push(level);
    }
  }

  return unique.slice(-3);
}

/**
 * Find resistance levels from recent swing highs
 */
function findResistanceLevels(history: StockHistory): number[] {
  if (history.length < 20) return [];

  const recent = history.slice(-90);
  const levels: number[] = [];

  for (let i = 2; i < recent.length - 2; i++) {
    if (
      recent[i].high > recent[i - 1].high &&
      recent[i].high > recent[i - 2].high &&
      recent[i].high > recent[i + 1].high &&
      recent[i].high > recent[i + 2].high
    ) {
      levels.push(Math.round(recent[i].high * 100) / 100);
    }
  }

  const unique: number[] = [];
  for (const level of levels.sort((a, b) => b - a)) {
    if (unique.length === 0 || Math.abs(level - unique[unique.length - 1]) / unique[unique.length - 1] > 0.02) {
      unique.push(level);
    }
  }

  return unique.slice(-3).reverse();
}

/**
 * Detect breakout zones - areas where price consolidated before a move
 */
function detectBreakoutZones(history: StockHistory): {
  breakoutZones: Array<{ low: number; high: number; type: 'bullish' | 'bearish' }>;
} {
  if (history.length < 30) return { breakoutZones: [] };

  const recent = history.slice(-60);
  const zones: Array<{ low: number; high: number; type: 'bullish' | 'bearish' }> = [];

  // Look for consolidation ranges (low volatility) followed by expansion
  for (let i = 10; i < recent.length - 5; i++) {
    const window = recent.slice(i - 10, i);
    const highs = window.map((d) => d.high);
    const lows = window.map((d) => d.low);
    const rangeHigh = Math.max(...highs);
    const rangeLow = Math.min(...lows);
    const rangePercent = ((rangeHigh - rangeLow) / rangeLow) * 100;

    // Tight consolidation (less than 5% range)
    if (rangePercent < 5 && rangePercent > 0.5) {
      const afterClose = recent[Math.min(i + 3, recent.length - 1)].close;
      if (afterClose > rangeHigh * 1.01) {
        zones.push({
          low: Math.round(rangeLow * 100) / 100,
          high: Math.round(rangeHigh * 100) / 100,
          type: 'bullish',
        });
      } else if (afterClose < rangeLow * 0.99) {
        zones.push({
          low: Math.round(rangeLow * 100) / 100,
          high: Math.round(rangeHigh * 100) / 100,
          type: 'bearish',
        });
      }
    }
  }

  // Return last 3 unique zones
  const unique = zones.filter(
    (z, i, arr) => arr.findIndex((a) => Math.abs(a.low - z.low) < z.low * 0.01) === i
  );
  return { breakoutZones: unique.slice(-3) };
}

/**
 * Determine trend direction based on multiple signals
 */
function determineTrend(
  sma20Val: number | null,
  sma50Val: number | null,
  ema20Val: number | null,
  rsiVal: number | null,
  macd: { macdLine: number | null; histogram: number | null },
  currentPrice: number
): 'bullish' | 'bearish' | 'neutral' {
  let score = 0;

  // SMA crossover
  if (sma20Val !== null && sma50Val !== null) {
    if (sma20Val > sma50Val) score += 1;
    else score -= 1;
  }

  // Price vs SMA20
  if (sma20Val !== null) {
    if (currentPrice > sma20Val) score += 1;
    else score -= 1;
  }

  // Price vs EMA20
  if (ema20Val !== null) {
    if (currentPrice > ema20Val) score += 1;
    else score -= 1;
  }

  // RSI
  if (rsiVal !== null) {
    if (rsiVal > 60) score += 1;
    else if (rsiVal < 40) score -= 1;
  }

  // MACD
  if (macd.macdLine !== null && macd.histogram !== null) {
    if (macd.macdLine > 0 && macd.histogram > 0) score += 1;
    else if (macd.macdLine < 0 && macd.histogram < 0) score -= 1;
  }

  if (score >= 3) return 'bullish';
  if (score <= -3) return 'bearish';
  return 'neutral';
}

/**
 * Comprehensive technical analysis
 */
export function analyzeTechnicals(
  history: StockHistory,
  currentPrice: number
): TechnicalIndicators {
  const closes = history.map((h) => h.close);

  const sma20Val = sma(closes, 20);
  const sma50Val = sma(closes, 50);
  const ema20Val = ema(closes, 20);
  const rsiVal = rsi(closes);
  const macd = calculateMACD(closes);
  const supportLevels = findSupportLevels(history);
  const resistanceLevels = findResistanceLevels(history);
  const { breakoutZones } = detectBreakoutZones(history);

  const trend = determineTrend(sma20Val, sma50Val, ema20Val, rsiVal, macd, currentPrice);

  return {
    sma20: sma20Val ? Math.round(sma20Val * 100) / 100 : null,
    sma50: sma50Val ? Math.round(sma50Val * 100) / 100 : null,
    ema20: ema20Val ? Math.round(ema20Val * 100) / 100 : null,
    rsi: rsiVal ? Math.round(rsiVal * 100) / 100 : null,
    macd: macd,
    supportLevels,
    resistanceLevels,
    breakoutZones,
    trend,
  };
}
