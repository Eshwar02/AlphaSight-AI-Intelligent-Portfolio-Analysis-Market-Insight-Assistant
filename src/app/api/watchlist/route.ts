import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchQuote } from "@/lib/stock/data";
import { resolveSymbol } from "@/lib/stock/symbols";

/**
 * GET /api/watchlist - Fetch the user's watchlist with current prices.
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

    const { data: items, error } = await supabase
      .from("watchlist")
      .select("id, symbol, added_at")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch watchlist" },
        { status: 500 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ watchlist: [] });
    }

    // Fetch current prices in parallel
    const enriched = await Promise.all(
      items.map(async (item) => {
        try {
          const quote = await fetchQuote(item.symbol);
          if (!quote) throw new Error('No quote');
          return {
            id: item.id,
            symbol: item.symbol,
            added_at: item.added_at,
            name: quote.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
            marketCap: quote.marketCap,
          };
        } catch {
          return {
            id: item.id,
            symbol: item.symbol,
            added_at: item.added_at,
            name: item.symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            volume: 0,
            marketCap: 0,
          };
        }
      })
    );

    return NextResponse.json({ watchlist: enriched });
  } catch (error) {
    console.error("GET /api/watchlist error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/watchlist - Add a symbol to the watchlist.
 * Body: { symbol: string }
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
    const { symbol } = body as { symbol?: string };

    if (!symbol || typeof symbol !== "string") {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 }
      );
    }

    // Resolve symbol
    const resolvedSymbol = await resolveSymbol(symbol);
    if (!resolvedSymbol) {
      return NextResponse.json(
        { error: "Invalid stock symbol" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("symbol", resolvedSymbol)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Symbol already in watchlist" },
        { status: 409 }
      );
    }

    // Validate symbol by fetching a quote
    const quote = await fetchQuote(resolvedSymbol);
    if (!quote) {
      return NextResponse.json(
        { error: "Unable to fetch data for this symbol" },
        { status: 400 }
      );
    }

    // Insert
    const { data: item, error: insertError } = await supabase
      .from("watchlist")
      .insert({ user_id: user.id, symbol: resolvedSymbol })
      .select("id, symbol, added_at")
      .single();

    if (insertError || !item) {
      return NextResponse.json(
        { error: "Failed to add to watchlist" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        item: {
          id: item.id,
          symbol: item.symbol,
          added_at: item.added_at,
          name: quote.name,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/watchlist error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/watchlist - Remove a symbol from the watchlist.
 * Query: ?symbol=AAPL or ?id=uuid
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol");
    const id = url.searchParams.get("id");

    if (!symbol && !id) {
      return NextResponse.json(
        { error: "Provide either symbol or id query parameter" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("watchlist")
      .delete()
      .eq("user_id", user.id);

    if (id) {
      query = query.eq("id", id);
    } else if (symbol) {
      query = query.eq("symbol", symbol.toUpperCase());
    }

    const { error: deleteError } = await query;

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to remove from watchlist" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/watchlist error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
