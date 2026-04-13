import yahooFinance from "yahoo-finance2";

type YahooQuote = {
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

type YahooChartQuote = {
  date: Date | string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
};

type YahooSearchResult = {
  quotes?: Array<Record<string, unknown>>;
  news?: Array<{
    title?: string;
    link?: string;
    publisher?: string;
    providerPublishTime?: number | Date;
  }>;
};

type YahooQuoteSummary = {
  assetProfile?: {
    sector?: string;
    industry?: string;
    longBusinessSummary?: string;
    fullTimeEmployees?: number;
    website?: string;
    country?: string;
  };
};

type YahooFinanceClient = {
  quote: (query: string) => Promise<YahooQuote | null>;
  chart: (
    query: string,
    options: {
      period1: Date;
      period2: Date;
      interval: "1d";
    }
  ) => Promise<{ quotes?: YahooChartQuote[] }>;
  quoteSummary: (
    query: string,
    options: { modules: string[] }
  ) => Promise<YahooQuoteSummary>;
  search: (
    query: string,
    options?: { newsCount?: number; quotesCount?: number }
  ) => Promise<YahooSearchResult>;
};

export const yahoo = yahooFinance as unknown as YahooFinanceClient;
