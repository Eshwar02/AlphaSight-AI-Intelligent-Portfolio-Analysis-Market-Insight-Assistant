import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_PORTFOLIO_ITEMS = 8;
const MAX_WATCHLIST_ITEMS = 10;
const MAX_MEMORY_CHARS = 500;

type PortfolioRow = {
  symbol: string;
  quantity: number;
  avg_buy_price: number;
  currency: string | null;
  notes: string | null;
};

type WatchlistRow = {
  symbol: string;
};

function formatCurrencySymbol(currency: string | null): string {
  switch ((currency ?? "").toUpperCase()) {
    case "USD":
      return "$";
    case "INR":
      return "₹";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    default:
      return "";
  }
}

/**
 * Build a concise "User Memory" block the LLM can use to personalize answers.
 * Includes the user's portfolio holdings + watchlist symbols only — no live
 * quotes (keeps latency low; AI does not need P&L to know what the user holds).
 *
 * Returns "" when the user has no saved holdings or watchlist entries so the
 * caller can skip appending an empty section.
 */
export async function buildUserContext(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const [portfolioResult, watchlistResult, memoryResult] = await Promise.all([
    supabase
      .from("portfolio_holdings")
      .select("symbol, quantity, avg_buy_price, currency, notes")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MAX_PORTFOLIO_ITEMS),
    supabase
      .from("watchlist")
      .select("symbol")
      .eq("user_id", userId)
      .order("added_at", { ascending: false })
      .limit(MAX_WATCHLIST_ITEMS),
    supabase
      .from("user_memory")
      .select("key, value")
      .eq("user_id", userId),
  ]);

  const portfolio: PortfolioRow[] = (portfolioResult.data ?? []) as PortfolioRow[];
  const watchlist: WatchlistRow[] = (watchlistResult.data ?? []) as WatchlistRow[];
  const memory: Array<{ key: string; value: string }> = (memoryResult.data ?? []) as Array<{ key: string; value: string }>;
  console.log("[user-context] Fetched memory:", memory);

  if (portfolio.length === 0 && watchlist.length === 0 && memory.length === 0) {
    return "";
  }

  const lines: string[] = ["## User Memory"];

  if (memory.length > 0) {
    for (const m of memory) {
      lines.push(`${m.key}: ${m.value}`);
    }
  }

  if (portfolio.length > 0) {
    const holdings = portfolio
      .map((h) => {
        const sym = formatCurrencySymbol(h.currency);
        const price = Number.isFinite(h.avg_buy_price)
          ? h.avg_buy_price.toFixed(2)
          : "?";
        return `${h.symbol} (${h.quantity} @ ${sym}${price})`;
      })
      .join(", ");
    lines.push(`Portfolio: ${holdings}`);
  }

  if (watchlist.length > 0) {
    const symbols = watchlist.map((w) => w.symbol).join(", ");
    lines.push(`Watchlist: ${symbols}`);
  }

  lines.push(
    "Use this context naturally when relevant (e.g. if user asks about their holdings, mentions a symbol they hold, or asks about remembered info like name). Never invent prices or positions not listed here."
  );

  const joined = lines.join("\n");
  return joined.length > MAX_MEMORY_CHARS
    ? joined.slice(0, MAX_MEMORY_CHARS - 1) + "…"
    : joined;
}
