import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchQuote } from "@/lib/stock/data";
import { assessMacroRisks } from "@/lib/stock/macro";
import { fetchStockNews } from "@/lib/stock/news";
import { generateDailyBrief } from "@/lib/ai";
import type { PortfolioSnapshot, PortfolioSnapshotItem } from "@/types/stock";
// Types

/**
 * GET /api/daily-brief - Fetch the latest daily brief for the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: briefs, error } = await supabase
      .from("daily_briefs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch briefs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ briefs: briefs || [] });
  } catch (error) {
    console.error("GET /api/daily-brief error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Build a portfolio snapshot with current prices and P&L for a set of holdings.
 */
async function buildPortfolioSnapshot(
  holdings: Array<{
    symbol: string;
    quantity: number;
    avg_buy_price: number;
  }>
): Promise<PortfolioSnapshot> {
  const items: PortfolioSnapshotItem[] = await Promise.all(
    holdings.map(async (h) => {
      let currentPrice = 0;
      try {
        const quote = await fetchQuote(h.symbol);
        currentPrice = quote?.price ?? 0;
      } catch {
        // Quote fetch failed
      }

      const currentValue = currentPrice * h.quantity;
      const investedValue = h.avg_buy_price * h.quantity;
      const pnl = currentValue - investedValue;
      const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

      return {
        symbol: h.symbol,
        quantity: h.quantity,
        avgBuyPrice: h.avg_buy_price,
        currentPrice,
        currentValue,
        pnl,
        pnlPercent,
      };
    })
  );

  const totalValue = items.reduce((sum, i) => sum + i.currentValue, 0);
  const totalInvested = items.reduce(
    (sum, i) => sum + i.avgBuyPrice * i.quantity,
    0
  );
  const totalPnl = totalValue - totalInvested;
  const totalPnlPercent =
    totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  return {
    holdings: items,
    totalValue,
    totalPnl,
    totalPnlPercent,
  };
}

/**
 * Generate a brief for a single user.
 */
async function generateBriefForUser(
  userId: string,
  holdings: Array<{ symbol: string; quantity: number; avg_buy_price: number }>
): Promise<{
  content: string;
  snapshot: PortfolioSnapshot;
} | null> {
  if (holdings.length === 0) return null;

  const snapshot = await buildPortfolioSnapshot(holdings);

  // Fetch market indices
  const indices = ['^GSPC', '^IXIC', '^DJI'];
  const marketIndices: Array<{ symbol: string; price: number; change: number; changePercent: number }> = [];
  for (const symbol of indices) {
    try {
      const quote = await fetchQuote(symbol);
      if (quote) {
        marketIndices.push({
          symbol: quote.symbol === '^GSPC' ? 'S&P 500' : quote.symbol === '^IXIC' ? 'NASDAQ' : 'Dow Jones',
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
        });
      }
    } catch {
      // Skip failed indices
    }
  }
  snapshot.marketIndices = marketIndices;

  // Sort by P&L for top movers
  const sorted = [...snapshot.holdings].sort(
    (a, b) => Math.abs(b.pnlPercent) - Math.abs(a.pnlPercent)
  );
  const topGainers = sorted
    .filter((h) => h.pnlPercent > 0)
    .slice(0, 3);
  const topLosers = sorted
    .filter((h) => h.pnlPercent < 0)
    .slice(0, 3);

  const macroRisks = assessMacroRisks(
    "SPY",
    "financial services",
    "United States"
  );

  // Fetch market indices
  const marketSymbols = ['^GSPC', '^IXIC', '^DJI']; // S&P 500, NASDAQ, Dow Jones
  const indexData: Array<{ symbol: string; price: number; change: number; changePercent: number }> = [];
  for (const symbol of marketSymbols) {
    try {
      const quote = await fetchQuote(symbol);
      if (quote) {
        indexData.push({
          symbol: quote.symbol === '^GSPC' ? 'S&P 500' : quote.symbol === '^IXIC' ? 'NASDAQ' : 'Dow Jones',
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
        });
      }
    } catch {
      // Skip failed indices
    }
  }

  // Fetch recent market news
  let marketNews = '';
  try {
    const news = await fetchStockNews('market', 'global market', []);
    if (news.length > 0) {
      marketNews = news.slice(0, 3).map(n => `- ${n.title} (${n.source})`).join('\n');
    }
  } catch {
    marketNews = 'Market news unavailable';
  }

  // Build comprehensive prompt for AI
  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  let prompt = `Generate a professional-grade daily portfolio brief for the user as of ${currentDate} at ${currentTime}.\n\n`;
  prompt += `Include relevant dates and timestamps in the analysis where appropriate for real-time context.\n\n`;

  prompt += `## Portfolio Data\n`;
  prompt += `- Total Value: $${snapshot.totalValue.toFixed(2)}\n`;
  prompt += `- Total P&L: $${snapshot.totalPnl.toFixed(2)} (${snapshot.totalPnlPercent.toFixed(2)}%)\n`;
  prompt += `- Number of Holdings: ${snapshot.holdings.length}\n\n`;

  if (topGainers.length > 0) {
    prompt += `## Top Gainers\n`;
    for (const g of topGainers) {
      prompt += `- ${g.symbol}: Current $${g.currentPrice.toFixed(2)}, P&L ${g.pnlPercent >= 0 ? "+" : ""}${g.pnlPercent.toFixed(2)}%\n`;
    }
    prompt += "\n";
  }

  if (topLosers.length > 0) {
    prompt += `## Top Losers\n`;
    for (const l of topLosers) {
      prompt += `- ${l.symbol}: Current $${l.currentPrice.toFixed(2)}, P&L ${l.pnlPercent.toFixed(2)}%\n`;
    }
    prompt += "\n";
  }

  prompt += `## Detailed Holdings\n`;
  for (const h of snapshot.holdings) {
    prompt += `- ${h.symbol}: ${h.quantity} shares @ avg $${h.avgBuyPrice.toFixed(2)}, current $${h.currentPrice.toFixed(2)}, P&L $${h.pnl.toFixed(2)} (${h.pnlPercent.toFixed(2)}%)\n`;
  }
  prompt += "\n";

  prompt += `## Market Indices\n`;
  for (const idx of indexData) {
    prompt += `- ${idx.symbol}: $${idx.price.toFixed(2)} (${idx.change >= 0 ? "+" : ""}$${idx.change.toFixed(2)}, ${idx.changePercent >= 0 ? "+" : ""}${idx.changePercent.toFixed(2)}%)\n`;
  }
  prompt += "\n";

  prompt += `## Recent Market News\n`;
  prompt += `${marketNews}\n\n`;

  prompt += `## Macro Risks\n`;
  for (const risk of macroRisks) {
    prompt += `- ${risk}\n`;
  }

  const content = await generateDailyBrief(prompt);

  return { content, snapshot };
}

/**
 * POST /api/daily-brief - Generate a new daily brief.
 * Can be triggered by:
 *   1. Authenticated user (generates for their portfolio)
 *   2. Cron job with CRON_SECRET header (generates for all users with portfolios)
 */
export async function POST(request: NextRequest) {
  try {
    // Support both Vercel cron (Authorization: Bearer <CRON_SECRET>) and custom header
    const cronSecret = request.headers.get("x-cron-secret");
    const authHeader = request.headers.get("authorization");
    const vercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isCronJob =
      vercelCron || (cronSecret && cronSecret === process.env.CRON_SECRET);

    if (isCronJob) {
      // Admin mode: generate briefs for all users with portfolios
      const adminSupabase = createAdminClient();

      // Get all distinct user IDs that have portfolio holdings
      const { data: userHoldings, error: holdingsError } = await adminSupabase
        .from("portfolio_holdings")
        .select("user_id, symbol, quantity, avg_buy_price");

      if (holdingsError || !userHoldings) {
        return NextResponse.json(
          { error: "Failed to fetch holdings" },
          { status: 500 }
        );
      }

      // Group holdings by user
      const userMap = new Map<
        string,
        Array<{ symbol: string; quantity: number; avg_buy_price: number }>
      >();
      for (const h of userHoldings) {
        if (!userMap.has(h.user_id)) {
          userMap.set(h.user_id, []);
        }
        userMap.get(h.user_id)!.push({
          symbol: h.symbol,
          quantity: h.quantity,
          avg_buy_price: h.avg_buy_price,
        });
      }

      let generated = 0;
      let failed = 0;

      // Generate brief for each user
      for (const [userId, holdings] of userMap.entries()) {
        try {
          const result = await generateBriefForUser(userId, holdings);
          if (result) {
            await adminSupabase.from("daily_briefs").insert({
              user_id: userId,
              content: result.content,
              portfolio_snapshot: result.snapshot as unknown as Record<string, unknown>,
            });
            generated++;
          }
        } catch (err) {
          console.error(`Failed to generate brief for user ${userId}:`, err);
          failed++;
        }
      }

      return NextResponse.json({
        success: true,
        generated,
        failed,
        totalUsers: userMap.size,
      });
    } else {
      // User mode: generate brief for authenticated user
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Fetch user's holdings
      const { data: holdings, error: holdingsError } = await supabase
        .from("portfolio_holdings")
        .select("symbol, quantity, avg_buy_price")
        .eq("user_id", user.id);

      if (holdingsError) {
        return NextResponse.json(
          { error: "Failed to fetch holdings" },
          { status: 500 }
        );
      }

      if (!holdings || holdings.length === 0) {
        return NextResponse.json(
          { error: "No portfolio holdings found. Add stocks to your portfolio first." },
          { status: 400 }
        );
      }

      const result = await generateBriefForUser(user.id, holdings);

      if (!result) {
        return NextResponse.json(
          { error: "Failed to generate brief" },
          { status: 500 }
        );
      }

      // Save to database
      const { data: brief, error: insertError } = await supabase
        .from("daily_briefs")
        .insert({
          user_id: user.id,
          content: result.content,
          portfolio_snapshot: result.snapshot as unknown as Record<string, unknown>,
        })
        .select("*")
        .single();

      if (insertError || !brief) {
        return NextResponse.json(
          { error: "Failed to save daily brief" },
          { status: 500 }
        );
      }

      return NextResponse.json({ brief }, { status: 201 });
    }
  } catch (error) {
    console.error("POST /api/daily-brief error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
