import type { StockQuote, StockHistory } from "@/types/stock";
import { yahoo } from "@/lib/stock/yahoo";

/**
 * Fetch a real-time quote for a given symbol.
 * Returns null if the symbol is invalid or the request fails.
 */
export async function fetchQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const result = await yahoo.quote(symbol);

    if (!result || !result.regularMarketPrice) {
      return null;
    }

    return {
      symbol: result.symbol,
      name: result.shortName || result.longName || result.symbol,
      price: result.regularMarketPrice,
      change: result.regularMarketChange ?? 0,
      changePercent: result.regularMarketChangePercent ?? 0,
      volume: result.regularMarketVolume ?? 0,
      marketCap: result.marketCap ?? 0,
      pe: result.trailingPE ?? null,
      high52: result.fiftyTwoWeekHigh ?? 0,
      low52: result.fiftyTwoWeekLow ?? 0,
      dayHigh: result.regularMarketDayHigh ?? 0,
      dayLow: result.regularMarketDayLow ?? 0,
      open: result.regularMarketOpen ?? 0,
      previousClose: result.regularMarketPreviousClose ?? 0,
      currency: result.currency || "USD",
      exchange: result.fullExchangeName || result.exchange || "",
    };
  } catch (error) {
    console.error(
      `[fetchQuote] Failed for ${symbol}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Fetch historical OHLCV price data for a symbol.
 * @param symbol  - Yahoo Finance symbol (e.g. "AAPL" or "RELIANCE.NS")
 * @param years   - Number of years of history to fetch (default 10)
 * @param period1 - Optional explicit start date (overrides years param)
 * @param period2 - Optional explicit end date (defaults to today)
 * Returns an empty array on failure.
 */
export async function fetchHistory(
  symbol: string,
  years: number = 10,
  period1?: Date,
  period2?: Date
): Promise<StockHistory> {
  try {
    const defaultStart = new Date();
    defaultStart.setFullYear(defaultStart.getFullYear() - years);

    const result = await yahoo.chart(symbol, {
      period1: period1 || defaultStart,
      period2: period2 || new Date(),
      interval: "1d",
    });

    if (!result.quotes || result.quotes.length === 0) return [];

    return result.quotes
      .filter((q) => q.close !== null && q.close !== undefined)
      .map((q) => ({
        date:
          q.date instanceof Date
            ? q.date.toISOString().split("T")[0]
            : String(q.date).split("T")[0],
        open: q.open ?? 0,
        high: q.high ?? 0,
        low: q.low ?? 0,
        close: q.close ?? 0,
        volume: q.volume ?? 0,
      }));
  } catch (error) {
    console.error(
      `[fetchHistory] Failed for ${symbol}:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * Fetch company profile / summary info.
 */
export async function fetchCompanyInfo(symbol: string): Promise<{
  sector: string;
  industry: string;
  description: string;
  employees: number | null;
  website: string;
  country: string;
}> {
  try {
    const result = await yahoo.quoteSummary(symbol, {
      modules: ["assetProfile"],
    });

    const profile = result.assetProfile;
    return {
      sector: profile?.sector || "Unknown",
      industry: profile?.industry || "Unknown",
      description: profile?.longBusinessSummary || "",
      employees: profile?.fullTimeEmployees ?? null,
      website: profile?.website || "",
      country: profile?.country || "",
    };
  } catch {
    return {
      sector: "Unknown",
      industry: "Unknown",
      description: "",
      employees: null,
      website: "",
      country: "",
    };
  }
}
