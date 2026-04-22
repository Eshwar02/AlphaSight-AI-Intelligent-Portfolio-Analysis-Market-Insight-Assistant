import { yahoo } from "@/lib/stock/yahoo";

// ── Top 100 US Stocks (company name/alias -> ticker) ───────────────

const US_STOCKS: Record<string, string> = {
  apple: "AAPL",
  microsoft: "MSFT",
  google: "GOOGL",
  alphabet: "GOOGL",
  amazon: "AMZN",
  nvidia: "NVDA",
  meta: "META",
  facebook: "META",
  tesla: "TSLA",
  "berkshire hathaway": "BRK-B",
  berkshire: "BRK-B",
  broadcom: "AVGO",
  jpmorgan: "JPM",
  "jp morgan": "JPM",
  "jpmorgan chase": "JPM",
  "eli lilly": "LLY",
  lilly: "LLY",
  visa: "V",
  unitedhealth: "UNH",
  "united health": "UNH",
  "exxon mobil": "XOM",
  exxon: "XOM",
  walmart: "WMT",
  "johnson & johnson": "JNJ",
  "johnson and johnson": "JNJ",
  "j&j": "JNJ",
  "procter & gamble": "PG",
  "procter and gamble": "PG",
  "p&g": "PG",
  mastercard: "MA",
  "home depot": "HD",
  costco: "COST",
  chevron: "CVX",
  abbvie: "ABBV",
  merck: "MRK",
  "coca-cola": "KO",
  "coca cola": "KO",
  coke: "KO",
  pepsi: "PEP",
  pepsico: "PEP",
  salesforce: "CRM",
  adobe: "ADBE",
  netflix: "NFLX",
  amd: "AMD",
  "advanced micro devices": "AMD",
  intel: "INTC",
  cisco: "CSCO",
  oracle: "ORCL",
  accenture: "ACN",
  "thermo fisher": "TMO",
  disney: "DIS",
  "walt disney": "DIS",
  nike: "NKE",
  mcdonalds: "MCD",
  "mcdonald's": "MCD",
  pfizer: "PFE",
  "bank of america": "BAC",
  "wells fargo": "WFC",
  "goldman sachs": "GS",
  "morgan stanley": "MS",
  citigroup: "C",
  citi: "C",
  qualcomm: "QCOM",
  "texas instruments": "TXN",
  boeing: "BA",
  caterpillar: "CAT",
  honeywell: "HON",
  "3m": "MMM",
  ibm: "IBM",
  "general electric": "GE",
  ge: "GE",
  "lockheed martin": "LMT",
  raytheon: "RTX",
  rtx: "RTX",
  "union pacific": "UNP",
  ups: "UPS",
  fedex: "FDX",
  starbucks: "SBUX",
  target: "TGT",
  lowes: "LOW",
  "lowe's": "LOW",
  uber: "UBER",
  airbnb: "ABNB",
  paypal: "PYPL",
  snowflake: "SNOW",
  palantir: "PLTR",
  crowdstrike: "CRWD",
  servicenow: "NOW",
  intuit: "INTU",
  astrazeneca: "AZN",
  amgen: "AMGN",
  gilead: "GILD",
  regeneron: "REGN",
  moderna: "MRNA",
  "applied materials": "AMAT",
  "lam research": "LRCX",
  micron: "MU",
  "analog devices": "ADI",
  synopsys: "SNPS",
  cadence: "CDNS",
  arm: "ARM",
  "arm holdings": "ARM",
  coinbase: "COIN",
  robinhood: "HOOD",
  rivian: "RIVN",
  lucid: "LCID",
  ford: "F",
  "general motors": "GM",
  gm: "GM",
  "at&t": "T",
  att: "T",
  verizon: "VZ",
  "t-mobile": "TMUS",
  spotify: "SPOT",
  shopify: "SHOP",
  zoom: "ZM",
  snap: "SNAP",
  snapchat: "SNAP",
  pinterest: "PINS",
  block: "SQ",
  square: "SQ",
};

// ── Top 100 Indian NSE Stocks (company name/alias -> NSE ticker without .NS) ──

const INDIAN_STOCKS: Record<string, string> = {
  reliance: "RELIANCE",
  "reliance industries": "RELIANCE",
  ril: "RELIANCE",
  tcs: "TCS",
  "tata consultancy": "TCS",
  "tata consultancy services": "TCS",
  "hdfc bank": "HDFCBANK",
  hdfcbank: "HDFCBANK",
  hdfc: "HDFCBANK",
  infosys: "INFY",
  infy: "INFY",
  "icici bank": "ICICIBANK",
  icici: "ICICIBANK",
  "hindustan unilever": "HINDUNILVR",
  hul: "HINDUNILVR",
  itc: "ITC",
  sbi: "SBIN",
  "state bank of india": "SBIN",
  "state bank": "SBIN",
  "bharti airtel": "BHARTIARTL",
  airtel: "BHARTIARTL",
  "kotak mahindra": "KOTAKBANK",
  "kotak bank": "KOTAKBANK",
  kotak: "KOTAKBANK",
  "bajaj finance": "BAJFINANCE",
  bajfinance: "BAJFINANCE",
  "larsen & toubro": "LT",
  "larsen and toubro": "LT",
  "l&t": "LT",
  "asian paints": "ASIANPAINT",
  "hcl technologies": "HCLTECH",
  "hcl tech": "HCLTECH",
  hcltech: "HCLTECH",
  "maruti suzuki": "MARUTI",
  maruti: "MARUTI",
  "sun pharma": "SUNPHARMA",
  "sun pharmaceutical": "SUNPHARMA",
  titan: "TITAN",
  "titan company": "TITAN",
  "bajaj finserv": "BAJAJFINSV",
  wipro: "WIPRO",
  "axis bank": "AXISBANK",
  axis: "AXISBANK",
  "ultratech cement": "ULTRACEMCO",
  ultratech: "ULTRACEMCO",
  "nestle india": "NESTLEIND",
  ntpc: "NTPC",
  "power grid": "POWERGRID",
  "power grid corporation": "POWERGRID",
  "tata motors": "TATAMOTORS",
  tatamotors: "TATAMOTORS",
  "tata steel": "TATASTEEL",
  tatasteel: "TATASTEEL",
  "adani enterprises": "ADANIENT",
  "adani ent": "ADANIENT",
  "adani ports": "ADANIPORTS",
  "adani green": "ADANIGREEN",
  mahindra: "M&M",
  "mahindra and mahindra": "M&M",
  "m&m": "M&M",
  "tech mahindra": "TECHM",
  techm: "TECHM",
  "indusind bank": "INDUSINDBK",
  indusind: "INDUSINDBK",
  "coal india": "COALINDIA",
  grasim: "GRASIM",
  "grasim industries": "GRASIM",
  britannia: "BRITANNIA",
  "britannia industries": "BRITANNIA",
  cipla: "CIPLA",
  "dr reddy": "DRREDDY",
  "dr reddys": "DRREDDY",
  "dr reddy's": "DRREDDY",
  "eicher motors": "EICHERMOT",
  eicher: "EICHERMOT",
  "hero motocorp": "HEROMOTOCO",
  "hero moto": "HEROMOTOCO",
  "bajaj auto": "BAJAJ-AUTO",
  "divis labs": "DIVISLAB",
  divi: "DIVISLAB",
  hindalco: "HINDALCO",
  "hindalco industries": "HINDALCO",
  "jsw steel": "JSWSTEEL",
  jsw: "JSWSTEEL",
  ongc: "ONGC",
  "oil and natural gas": "ONGC",
  bpcl: "BPCL",
  "bharat petroleum": "BPCL",
  ioc: "IOC",
  "indian oil": "IOC",
  "indian oil corporation": "IOC",
  vedanta: "VEDL",
  vedl: "VEDL",
  "tata power": "TATAPOWER",
  "tata consumer": "TATACONSUM",
  "tata consumer products": "TATACONSUM",
  "apollo hospitals": "APOLLOHOSP",
  apollo: "APOLLOHOSP",
  dabur: "DABUR",
  "dabur india": "DABUR",
  "godrej consumer": "GODREJCP",
  godrej: "GODREJCP",
  havells: "HAVELLS",
  "havells india": "HAVELLS",
  pidilite: "PIDILITIND",
  "pidilite industries": "PIDILITIND",
  "siemens india": "SIEMENS",
  "amara raja": "AMARARAJA",
  "amara raja energy": "AMARARAJA",
  amararaja: "AMARARAJA",
  "berger paints": "BERGEPAINT",
  berger: "BERGEPAINT",
  biocon: "BIOCON",
  colgate: "COLPAL",
  "colgate palmolive india": "COLPAL",
  delhivery: "DELHIVERY",
  dixon: "DIXON",
  "dixon technologies": "DIXON",
  "hdfc life": "HDFCLIFE",
  "icici lombard": "ICICIGI",
  "icici prudential": "ICICIPRULI",
  "sbi life": "SBILIFE",
  "sbi cards": "SBICARD",
  indigo: "INDIGO",
  "interglobe aviation": "INDIGO",
  irctc: "IRCTC",
  zomato: "ZOMATO",
  paytm: "PAYTM",
  one97: "PAYTM",
  nykaa: "NYKAA",
  policybazaar: "POLICYBZR",
  "pb fintech": "POLICYBZR",
  trent: "TRENT",
  "trent limited": "TRENT",
  "varun beverages": "VBL",
  vbl: "VBL",
  "persistent systems": "PERSISTENT",
  persistent: "PERSISTENT",
  coforge: "COFORGE",
  ltimindtree: "LTIM",
  "lti mindtree": "LTIM",
  mphasis: "MPHASIS",
  "zee entertainment": "ZEEL",
  zee: "ZEEL",
};

// Sets for fast direct-ticker lookups
const KNOWN_NSE_TICKERS = new Set(Object.values(INDIAN_STOCKS));
const KNOWN_US_TICKERS = new Set(Object.values(US_STOCKS));

// Words that hint the user means an Indian stock
const INDIAN_INDICATORS = [
  "nse",
  "bse",
  "india",
  "indian",
  ".ns",
  "sensex",
  "nifty",
  "rupee",
  "inr",
  "mumbai",
  "bombay",
];

function isLikelyIndianQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return INDIAN_INDICATORS.some((ind) => lower.includes(ind));
}

function isCryptoQuery(query: string): boolean {
  return /\b(crypto|bitcoin|btc|ethereum|eth|solana|sol|doge|xrp)\b/i.test(
    query
  );
}

/**
 * Resolve a user query into a valid Yahoo Finance ticker symbol.
 *
 * Resolution order:
 * 1. Already has .NS/.BO suffix -> return as-is
 * 2. Direct ticker match in known US or Indian tickers
 * 3. Company name lookup (Indian map checked first when Indian indicators present)
 * 4. Partial / fuzzy name matching across both maps
 * 5. Yahoo Finance search API as final fallback
 * 6. If nothing matches, return the uppercased query as a ticker guess
 */
export async function resolveSymbol(query: string): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  const upper = trimmed.toUpperCase();

  // 1. Already has exchange suffix
  if (lower.endsWith(".ns") || lower.endsWith(".bo")) {
    return upper;
  }

  // 2. Direct ticker match
  if (KNOWN_US_TICKERS.has(upper)) return upper;
  if (KNOWN_NSE_TICKERS.has(upper)) return `${upper}.NS`;

  // Clean query: strip common suffixes
  const cleanLower = lower
    .replace(/\b(nse|bse|india|indian|limited|ltd|inc|corp|corporation)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const forceIndian = isLikelyIndianQuery(lower);

  // 3. Exact name lookup
  if (forceIndian) {
    const indianMatch = INDIAN_STOCKS[cleanLower] || INDIAN_STOCKS[lower];
    if (indianMatch) return `${indianMatch}.NS`;
  }

  // Check both maps (Indian first if hinted, otherwise US first)
  const usMatch = US_STOCKS[cleanLower] || US_STOCKS[lower];
  const indianMatch = INDIAN_STOCKS[cleanLower] || INDIAN_STOCKS[lower];

  if (!forceIndian && usMatch) return usMatch;
  if (indianMatch) return `${indianMatch}.NS`;
  if (usMatch) return usMatch;

  // 4. Partial / fuzzy matching
  let bestMatch: { symbol: string; market: "us" | "india" } | null = null;
  let bestScore = 0;

  const tryPartialMatch = (
    map: Record<string, string>,
    market: "us" | "india"
  ) => {
    for (const [name, symbol] of Object.entries(map)) {
      if (name.includes(cleanLower) || cleanLower.includes(name)) {
        const score =
          Math.min(name.length, cleanLower.length) /
          Math.max(name.length, cleanLower.length);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { symbol, market };
        }
      }
    }
  };

  if (forceIndian) {
    tryPartialMatch(INDIAN_STOCKS, "india");
  } else {
    tryPartialMatch(US_STOCKS, "us");
    tryPartialMatch(INDIAN_STOCKS, "india");
  }

  if (bestMatch && bestScore > 0.4) {
    return (bestMatch as { symbol: string; market: "us" | "india" }).market === "india"
      ? `${(bestMatch as { symbol: string; market: "us" | "india" }).symbol}.NS`
      : (bestMatch as { symbol: string; market: "us" | "india" }).symbol;
  }

  // 5. Yahoo Finance search fallback
  try {
    const results = await yahoo.search(query, {
      newsCount: 0,
      quotesCount: 5,
    });
    if (results.quotes && results.quotes.length > 0) {
      const isCrypto = isCryptoQuery(query);
      const quotes = results.quotes.filter(
        (q): q is Record<string, unknown> =>
          !!q && typeof q === "object" && "symbol" in q && !!q.symbol
      );

      const preferred = isCrypto
        ? quotes.find((q) => {
            const quoteType = String(q.quoteType || "").toUpperCase();
            const symbol = String(q.symbol || "").toUpperCase();
            return quoteType === "CRYPTOCURRENCY" || symbol.includes("-USD");
          })
        : quotes.find((q) => {
            const quoteType = String(q.quoteType || "").toUpperCase();
            const symbol = String(q.symbol || "").toUpperCase();
            return (
              (quoteType === "EQUITY" || quoteType === "ETF") &&
              !symbol.includes("-USD")
            );
          });

      if (preferred?.symbol) {
        return String(preferred.symbol);
      }
    }
  } catch {
    // Search failed, continue to fallback
  }

  // 6. If it looks like a standalone ticker, return it as-is
  if (!/\s/.test(trimmed) && upper.length <= 8 && /^[A-Z0-9&\-.]+$/.test(upper)) {
    return forceIndian ? `${upper}.NS` : upper;
  }

  return null;
}

/**
 * Search for stocks matching a query string. Returns top results.
 */
export async function searchSymbols(
  query: string
): Promise<Array<{ symbol: string; name: string; exchange: string; type: string }>> {
  try {
    const results = await yahoo.search(query, { newsCount: 0 });
    if (!results.quotes) return [];

    return results.quotes
      .filter((q: Record<string, unknown>) => "symbol" in q && q.symbol)
      .slice(0, 10)
      .map((q: Record<string, unknown>) => ({
        symbol: (q.symbol as string) || "",
        name: (q.shortname as string) || (q.longname as string) || "",
        exchange: (q.exchange as string) || "",
        type: (q.quoteType as string) || "",
      }));
  } catch {
    return [];
  }
}

/**
 * Detect if a symbol is an Indian (NSE/BSE) stock.
 */
export function isIndianStock(symbol: string): boolean {
  return symbol.endsWith(".NS") || symbol.endsWith(".BO");
}

/**
 * Get the country for a stock symbol.
 */
export function getStockCountry(symbol: string): "India" | "US" {
  return isIndianStock(symbol) ? "India" : "US";
}
