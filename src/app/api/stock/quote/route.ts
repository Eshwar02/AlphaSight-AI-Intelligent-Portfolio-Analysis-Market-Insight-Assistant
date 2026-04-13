import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchQuote } from "@/lib/stock/data";
import { resolveSymbol } from "@/lib/stock/symbols";

/**
 * GET /api/stock/quote?symbol=AAPL - Fetch a quick stock quote.
 */
export async function GET(request: NextRequest) {
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

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol query parameter is required" },
        { status: 400 }
      );
    }

    // Resolve the symbol (handles company names, partial matches, etc.)
    const resolvedSymbol = await resolveSymbol(symbol);
    if (!resolvedSymbol) {
      return NextResponse.json(
        { error: "Unable to resolve stock symbol" },
        { status: 404 }
      );
    }

    const quote = await fetchQuote(resolvedSymbol);

    return NextResponse.json({ quote });
  } catch (error) {
    console.error("GET /api/stock/quote error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock quote" },
      { status: 500 }
    );
  }
}
