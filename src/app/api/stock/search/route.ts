import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchSymbols } from "@/lib/stock/symbols";

/**
 * GET /api/stock/search?q=apple - Search/autocomplete for stock symbols.
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
    const query = url.searchParams.get("q");

    if (!query || query.trim().length < 1) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required (minimum 1 character)" },
        { status: 400 }
      );
    }

    const results = await searchSymbols(query.trim());

    return NextResponse.json({ results });
  } catch (error) {
    console.error("GET /api/stock/search error:", error);
    return NextResponse.json(
      { error: "Failed to search stocks" },
      { status: 500 }
    );
  }
}
