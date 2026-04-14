/**
 * Yahoo Finance API wrapper.
 *
 * Yahoo has progressively locked down its APIs:
 *  - v7/v6 quote endpoints → 401/404 (requires crumb auth, rate-limited)
 *  - v10 quoteSummary → 401
 *  - v8 chart → works (also includes quote data in `meta`)
 *  - v1 search → works
 *
 * Strategy: use the v8 chart endpoint for both quotes and history,
 * and the v1 search endpoint for symbol lookup.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ── Types ───────────────────────────────────────────────────────────

export type YahooQuote = {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  trailingPE?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketOpen?: number;
  regularMarketPreviousClose?: number;
  currency?: string;
  fullExchangeName?: string;
  exchange?: string;
};

export type YahooChartQuote = {
  date: Date | string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
};

export type YahooSearchResult = {
  quotes?: Array<Record<string, unknown>>;
  news?: Array<{
    title?: string;
    link?: string;
    publisher?: string;
    providerPublishTime?: number | Date;
  }>;
};

export type YahooQuoteSummary = {
  assetProfile?: {
    sector?: string;
    industry?: string;
    longBusinessSummary?: string;
    fullTimeEmployees?: number;
    website?: string;
    country?: string;
  };
};

// ── Helpers ──────────────────────────────────────────────────────────

async function fetchChartRaw(
  symbol: string,
  params: string
): Promise<{ meta: Record<string, unknown>; quotes: YahooChartQuote[] }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });

  if (!res.ok) {
    throw new Error(`Yahoo chart API ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("No chart result");

  const meta = result.meta || {};
  const timestamps: number[] = result.timestamp || [];
  const ohlcv = result.indicators?.quote?.[0] || {};
  const opens: (number | null)[] = ohlcv.open || [];
  const highs: (number | null)[] = ohlcv.high || [];
  const lows: (number | null)[] = ohlcv.low || [];
  const closes: (number | null)[] = ohlcv.close || [];
  const volumes: (number | null)[] = ohlcv.volume || [];

  const quotes: YahooChartQuote[] = timestamps.map((ts, i) => ({
    date: new Date(ts * 1000),
    open: opens[i] ?? null,
    high: highs[i] ?? null,
    low: lows[i] ?? null,
    close: closes[i] ?? null,
    volume: volumes[i] ?? null,
  }));

  return { meta, quotes };
}

// ── Public API ──────────────────────────────────────────────────────

export const yahoo = {
  /**
   * Fetch a real-time quote by piggy-backing on the chart endpoint's `meta`.
   */
  async quote(symbol: string): Promise<YahooQuote | null> {
    try {
      const { meta } = await fetchChartRaw(symbol, "interval=1d&range=5d");

      return {
        symbol: (meta.symbol as string) || symbol,
        shortName: meta.shortName as string | undefined,
        longName: meta.longName as string | undefined,
        regularMarketPrice: meta.regularMarketPrice as number | undefined,
        regularMarketChange: undefined, // computed by caller from previousClose
        regularMarketChangePercent: undefined,
        regularMarketVolume: meta.regularMarketVolume as number | undefined,
        marketCap: undefined, // not in chart meta
        trailingPE: undefined,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh as number | undefined,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow as number | undefined,
        regularMarketDayHigh: meta.regularMarketDayHigh as number | undefined,
        regularMarketDayLow: meta.regularMarketDayLow as number | undefined,
        regularMarketOpen: undefined,
        regularMarketPreviousClose: meta.chartPreviousClose as number | undefined,
        currency: (meta.currency as string) || "USD",
        fullExchangeName: meta.fullExchangeName as string | undefined,
        exchange: meta.exchangeName as string | undefined,
      };
    } catch (error) {
      console.error(`[yahoo.quote] Failed for ${symbol}:`, (error as Error).message);
      return null;
    }
  },

  /**
   * Fetch historical OHLCV data.
   */
  async chart(
    symbol: string,
    options: { period1: Date; period2: Date; interval: "1d" }
  ): Promise<{ quotes: YahooChartQuote[] }> {
    const p1 = Math.floor(options.period1.getTime() / 1000);
    const p2 = Math.floor(options.period2.getTime() / 1000);
    const { quotes } = await fetchChartRaw(
      symbol,
      `period1=${p1}&period2=${p2}&interval=${options.interval}`
    );
    return { quotes };
  },

  /**
   * Fetch company profile. quoteSummary API is now 401, so we return
   * a minimal profile derived from search results when possible.
   */
  async quoteSummary(
    symbol: string,
    _options: { modules: string[] }
  ): Promise<YahooQuoteSummary> {
    // Try to get sector/industry from search results
    try {
      const searchResult = await yahoo.search(symbol, { newsCount: 0, quotesCount: 1 });
      const q = searchResult.quotes?.[0];
      if (q) {
        return {
          assetProfile: {
            sector: (q.sector as string) || "Unknown",
            industry: (q.industry as string) || "Unknown",
            longBusinessSummary: "",
            fullTimeEmployees: undefined,
            website: "",
            country: "",
          },
        };
      }
    } catch {
      // Fallback below
    }

    return {
      assetProfile: {
        sector: "Unknown",
        industry: "Unknown",
        longBusinessSummary: "",
        fullTimeEmployees: undefined,
        website: "",
        country: "",
      },
    };
  },

  /**
   * Search for stocks / news.
   */
  async search(
    query: string,
    options?: { newsCount?: number; quotesCount?: number }
  ): Promise<YahooSearchResult> {
    const params = new URLSearchParams({
      q: query,
      newsCount: String(options?.newsCount ?? 5),
      quotesCount: String(options?.quotesCount ?? 10),
    });
    const url = `https://query2.finance.yahoo.com/v1/finance/search?${params}`;

    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      throw new Error(`Yahoo search API ${res.status}`);
    }

    return await res.json();
  },
};
