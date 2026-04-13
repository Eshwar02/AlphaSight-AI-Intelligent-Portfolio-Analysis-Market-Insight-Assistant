import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchQuote } from "@/lib/stock/data";
import { resolveSymbol } from "@/lib/stock/symbols";
import type { PortfolioHolding } from "@/types/stock";

/**
 * GET /api/portfolio - Fetch all holdings for the authenticated user
 * with current prices and P&L calculations.
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

    const { data: holdings, error } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch portfolio" },
        { status: 500 }
      );
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        holdings: [],
        totalValue: 0,
        totalInvested: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
      });
    }

    // Fetch current prices in parallel
    const enrichedHoldings: PortfolioHolding[] = await Promise.all(
      holdings.map(async (holding) => {
        try {
          const quote = await fetchQuote(holding.symbol);
          if (!quote) throw new Error('No quote');
          const currentPrice = quote.price;
          const currentValue = currentPrice * holding.quantity;
          const investedValue = holding.avg_buy_price * holding.quantity;
          const pnl = currentValue - investedValue;
          const pnlPercent =
            investedValue > 0 ? (pnl / investedValue) * 100 : 0;

          return {
            ...holding,
            currentPrice,
            currentValue,
            pnl,
            pnlPercent,
          };
        } catch {
          // If quote fails, return with zero current data
          return {
            ...holding,
            currentPrice: 0,
            currentValue: 0,
            pnl: 0,
            pnlPercent: 0,
          };
        }
      })
    );

    const totalValue = enrichedHoldings.reduce(
      (sum, h) => sum + h.currentValue,
      0
    );
    const totalInvested = enrichedHoldings.reduce(
      (sum, h) => sum + h.avg_buy_price * h.quantity,
      0
    );
    const totalPnl = totalValue - totalInvested;
    const totalPnlPercent =
      totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    return NextResponse.json({
      holdings: enrichedHoldings,
      totalValue,
      totalInvested,
      totalPnl,
      totalPnlPercent,
    });
  } catch (error) {
    console.error("GET /api/portfolio error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portfolio - Add a new holding.
 * Body: { symbol: string, quantity: number, avgBuyPrice: number, notes?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { symbol, quantity, avgBuyPrice, notes } = body as {
      symbol?: string;
      quantity?: number;
      avgBuyPrice?: number;
      notes?: string;
    };

    // Validate inputs
    if (!symbol || typeof symbol !== "string") {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 }
      );
    }

    if (typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json(
        { error: "Quantity must be a positive number" },
        { status: 400 }
      );
    }

    if (typeof avgBuyPrice !== "number" || avgBuyPrice <= 0) {
      return NextResponse.json(
        { error: "Average buy price must be a positive number" },
        { status: 400 }
      );
    }

    // Resolve and validate symbol
    const resolvedSymbol = await resolveSymbol(symbol);
    if (!resolvedSymbol) {
      return NextResponse.json(
        { error: "Invalid stock symbol" },
        { status: 400 }
      );
    }

    // Fetch current quote to validate symbol and get current data
    const quote = await fetchQuote(resolvedSymbol);
    if (!quote) {
      return NextResponse.json(
        { error: "Unable to fetch quote for symbol" },
        { status: 400 }
      );
    }
    const currentPrice = quote.price;

    // Check for existing holding of same symbol
    const { data: existing } = await supabase
      .from("portfolio_holdings")
      .select("id")
      .eq("user_id", user.id)
      .eq("symbol", resolvedSymbol)
      .single();

    if (existing) {
      return NextResponse.json(
        {
          error: "You already have a holding for this symbol. Update it instead.",
        },
        { status: 409 }
      );
    }

    // Insert holding
    const { data: holding, error: insertError } = await supabase
      .from("portfolio_holdings")
      .insert({
        user_id: user.id,
        symbol: resolvedSymbol,
        quantity,
        avg_buy_price: avgBuyPrice,
        notes: notes || null,
      })
      .select("*")
      .single();

    if (insertError || !holding) {
      return NextResponse.json(
        { error: "Failed to add holding" },
        { status: 500 }
      );
    }

    // Calculate P&L
    const currentValue = currentPrice * quantity;
    const investedValue = avgBuyPrice * quantity;
    const pnl = currentValue - investedValue;
    const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

    return NextResponse.json(
      {
        holding: {
          ...holding,
          currentPrice,
          currentValue,
          pnl,
          pnlPercent,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/portfolio error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
