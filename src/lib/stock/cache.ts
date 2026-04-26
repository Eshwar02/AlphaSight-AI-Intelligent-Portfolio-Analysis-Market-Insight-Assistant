import type { StockQuote, StockHistory, NewsItem } from "@/types/stock";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
const stockCache = new MemoryCache();

// Cache TTLs (in seconds)
const CACHE_TTL = {
  QUOTE: 60,        // 1 minute - quotes change frequently
  HISTORY: 300,     // 5 minutes - historical data is stable
  NEWS: 120,        // 2 minutes - for more real-time news
  COMPANY_INFO: 3600, // 1 hour - company info is very stable
} as const;

// Clean up cache every 5 minutes
setInterval(() => stockCache.cleanup(), 5 * 60 * 1000);

export { stockCache, CACHE_TTL };