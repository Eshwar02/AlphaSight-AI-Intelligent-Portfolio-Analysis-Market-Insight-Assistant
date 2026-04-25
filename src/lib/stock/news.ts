import type { NewsItem } from "@/types/stock";
import { yahoo } from "@/lib/stock/yahoo";
import { stockCache, CACHE_TTL } from "./cache";

const MARKETAUX_API_KEY = process.env.MARKETAUX_API_KEY;
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const MAX_NEWS_ITEMS = 12;

interface NewsdataArticle {
  title: string;
  link: string;
  source_name: string;
  pubDate: string;
  description: string;
}

/**
 * Fetch news from NewsData.io API
 */
async function fetchNewsdataNews(symbol: string, companyName: string): Promise<NewsItem[]> {
  if (!NEWSDATA_API_KEY) return [];

  try {
    const query = companyName || symbol.replace(/\.(NS|BO)$/, '');
    const url = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&q=${encodeURIComponent(query)}&language=en&category=business&size=5`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((article: NewsdataArticle) => ({
      title: article.title || '',
      url: article.link || '',
      source: article.source_name || 'NewsData',
      publishedAt: article.pubDate || new Date().toISOString(),
      summary: article.description || article.title || '',
    }));
  } catch {
    return [];
  }
}

interface MarketauxArticle {
  title: string;
  url: string;
  source: string;
  published_at: string;
  description: string;
  snippet: string;
}

const SOURCE_SITES = [
  "mint",
  "goodreturns",
  "moneycontrol",
  "economictimes",
  "livemint",
  "business-standard",
  "reuters",
  "bloomberg",
];

const COMPANY_PRODUCT_THEMES: Array<{
  matcher: RegExp;
  themes: string[];
}> = [
  {
    matcher: /\b(amara\s*raja|amararaja|amraraaja|amara\s*raja\s*energy)\b/i,
    themes: [
      "lithium battery",
      "lithium ion cell",
      "ev battery",
      "energy storage battery",
      "lead acid battery",
    ],
  },
  {
    matcher: /\b(reliance|ril)\b/i,
    themes: ["petrochemicals", "new energy", "solar", "green hydrogen"],
  },
];

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeXmlEntities(match?.[1]?.trim() || "");
}

function sourceFromLink(link: string): string {
  try {
    const host = new URL(link).hostname.toLowerCase();
    if (host.includes("mint")) return "Mint";
    if (host.includes("goodreturns")) return "GoodReturns";
    if (host.includes("moneycontrol")) return "Moneycontrol";
    if (host.includes("economictimes")) return "Economic Times";
    if (host.includes("livemint")) return "Mint";
    if (host.includes("reuters")) return "Reuters";
    if (host.includes("bloomberg")) return "Bloomberg";
    return host.replace(/^www\./, "");
  } catch {
    return "Google News";
  }
}

async function fetchGoogleNewsRss(query: string): Promise<NewsItem[]> {
  if (!query.trim()) return [];

  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
      query
    )}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null = itemRegex.exec(xml);

    while (match) {
      const block = match[1];
      const title = extractTag(block, "title");
      const link = extractTag(block, "link");
      const pubDate = extractTag(block, "pubDate");
      const description = extractTag(block, "description");
      const source = sourceFromLink(link);

      if (title && link) {
        items.push({
          title,
          url: link,
          source,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          summary: description || title,
        });
      }

      match = itemRegex.exec(xml);
    }

    return items.slice(0, 8);
  } catch {
    return [];
  }
}

function deriveThemeQueries(symbol: string, companyName: string): string[] {
  const base = `${companyName || symbol}`.trim();
  const themeSet = new Set<string>();

  for (const entry of COMPANY_PRODUCT_THEMES) {
    if (entry.matcher.test(base) || entry.matcher.test(symbol)) {
      for (const t of entry.themes) themeSet.add(`${base} ${t}`);
    }
  }

  return Array.from(themeSet);
}

/**
 * Fetch real-time news from MarketAux API
 */
async function fetchMarketauxNews(symbol: string): Promise<NewsItem[]> {
  if (!MARKETAUX_API_KEY) return [];

  try {
    const cleanSymbol = symbol.replace(/\.(NS|BO)$/, '');
    const url = `https://api.marketaux.com/v1/news/all?symbols=${cleanSymbol}&filter_entities=true&language=en&api_token=${MARKETAUX_API_KEY}&limit=6`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return [];

    return data.data.map((article: MarketauxArticle) => ({
      title: article.title || '',
      url: article.url || '',
      source: article.source || 'MarketAux',
      publishedAt: article.published_at || new Date().toISOString(),
      summary: article.description || article.snippet || article.title || '',
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch recent news for a stock.
 * Tries MarketAux API first for real-time news, falls back to Yahoo Finance.
 * Returns 5-10 relevant, deduplicated news items sorted by date.
 *
 * @param symbol      - Yahoo Finance ticker (e.g. "AAPL", "RELIANCE.NS")
 * @param companyName - Human-readable company name for fallback search
 */
export async function fetchStockNews(
  symbol: string,
  companyName: string = "",
  extraThemeQueries: string[] = []
): Promise<NewsItem[]> {
  const cacheKey = `news:${symbol.toUpperCase()}:${companyName}`;
  const cached = stockCache.get<NewsItem[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const themeQueries =
    extraThemeQueries.length > 0
      ? extraThemeQueries
      : deriveThemeQueries(symbol, companyName);

  // Try MarketAux first for real-time news
  const marketauxNews = await fetchMarketauxNews(symbol);

  // Try NewsData.io as second source
  const newsdataNews = await fetchNewsdataNews(symbol, companyName);

  const newsItems: NewsItem[] = [...marketauxNews, ...newsdataNews];

  // Query Google News RSS for company headlines across common business outlets.
  const sourceQuery =
    companyName && companyName.trim().length > 0 ? companyName : symbol.replace(/\.(NS|BO)$/, "");
  const siteFilter = SOURCE_SITES.map((s) => `site:${s}`).join(" OR ");
  const googleCompanyNews = await fetchGoogleNewsRss(`${sourceQuery} (${siteFilter})`);
  newsItems.push(...googleCompanyNews);

  // Product/theme-based enrichment (key requirement) - limit to 2 for performance
  for (const q of themeQueries.slice(0, 2)) {
    const thematic = await fetchGoogleNewsRss(`${q} (${siteFilter})`);
    newsItems.push(...thematic);
  }

  // Strategy 1: Search by ticker symbol - disabled to prioritize real-time APIs
  // try {
  //   const searchResult = await yahoo.search(symbol, {
  //     newsCount: 10,
  //     quotesCount: 0,
  //   });

  //   if (searchResult.news && searchResult.news.length > 0) {
  //     for (const item of searchResult.news) {
  //       newsItems.push(mapNewsItem(item));
  //     }
  //   }
  // } catch (error) {
  //   console.error(
  //     `[fetchStockNews] Search by symbol failed for ${symbol}:`,
  //     error instanceof Error ? error.message : error
  //   );
  // }

  // Strategy 2: If too few results, also try searching by company name - disabled
  // if (newsItems.length < 3 && companyName) {
  //   try {
  //     const nameSearch = await yahoo.search(companyName, {
  //       newsCount: 10,
  //       quotesCount: 0,
  //     });

  //   if (nameSearch.news && nameSearch.news.length > 0) {
  //     for (const item of nameSearch.news) {
  //       newsItems.push(mapNewsItem(item));
  //     }
  //   }
  // } catch (error) {
  //   console.error(
  //     `[fetchStockNews] Search by name failed for ${companyName}:`,
  //     error instanceof Error ? error.message : error
  //   );
  // }
  // }

  if (newsItems.length === 0) return [];

  // Deduplicate by title
  const seen = new Set<string>();
  const unique = newsItems.filter((item) => {
    const key = item.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Return up to 6 items (reduced for performance), most recent first
  const result = unique
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, 6);

  // Cache the result
  if (result.length > 0) {
    stockCache.set(cacheKey, result, CACHE_TTL.NEWS);
  }

  return result;
}

// ── Helper ───────────────────────────────────────────────────────────

function mapNewsItem(item: {
  title?: string;
  link?: string;
  publisher?: string;
  providerPublishTime?: number | Date;
}): NewsItem {
  let publishedAt: string;
  if (item.providerPublishTime) {
    const ts = item.providerPublishTime;
    // yahoo-finance2 may return seconds-since-epoch or a Date object
    publishedAt =
      typeof ts === "number"
        ? new Date(ts < 1e12 ? ts * 1000 : ts).toISOString()
        : ts instanceof Date
          ? ts.toISOString()
          : new Date().toISOString();
  } else {
    publishedAt = new Date().toISOString();
  }

  return {
    title: item.title || "Untitled",
    url: item.link || "",
    source: item.publisher || "Yahoo Finance",
    publishedAt,
    summary: item.title || "",
  };
}
