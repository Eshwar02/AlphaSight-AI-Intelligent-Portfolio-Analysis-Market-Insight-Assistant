import type { NewsItem } from "@/types/stock";
import { yahoo } from "@/lib/stock/yahoo";

const MARKETAUX_API_KEY = process.env.MARKETAUX_API_KEY;
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;

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
  companyName: string = ""
): Promise<NewsItem[]> {
  // Try MarketAux first for real-time news
  const marketauxNews = await fetchMarketauxNews(symbol);
  if (marketauxNews.length >= 3) return marketauxNews;

  // Try NewsData.io as second source
  const newsdataNews = await fetchNewsdataNews(symbol, companyName);
  if (newsdataNews.length >= 3) return [...marketauxNews, ...newsdataNews].slice(0, 10);

  const newsItems: NewsItem[] = [...marketauxNews, ...newsdataNews];

  // Strategy 1: Search by ticker symbol
  try {
    const searchResult = await yahoo.search(symbol, {
      newsCount: 10,
      quotesCount: 0,
    });

    if (searchResult.news && searchResult.news.length > 0) {
      for (const item of searchResult.news) {
        newsItems.push(mapNewsItem(item));
      }
    }
  } catch (error) {
    console.error(
      `[fetchStockNews] Search by symbol failed for ${symbol}:`,
      error instanceof Error ? error.message : error
    );
  }

  // Strategy 2: If too few results, also try searching by company name
  if (newsItems.length < 3 && companyName) {
    try {
      const nameSearch = await yahoo.search(companyName, {
        newsCount: 10,
        quotesCount: 0,
      });

      if (nameSearch.news && nameSearch.news.length > 0) {
        for (const item of nameSearch.news) {
          newsItems.push(mapNewsItem(item));
        }
      }
    } catch (error) {
      console.error(
        `[fetchStockNews] Search by name failed for ${companyName}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  if (newsItems.length === 0) return [];

  // Deduplicate by title
  const seen = new Set<string>();
  const unique = newsItems.filter((item) => {
    const key = item.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Return up to 10 items, most recent first
  return unique
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, 10);
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
