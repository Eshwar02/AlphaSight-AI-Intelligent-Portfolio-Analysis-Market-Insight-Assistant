import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchQuote } from "@/lib/stock/data";

/**
 * PUT /api/portfolio/[id] - Update a portfolio holding.
 * Body: { quantity?: number, avgBuyPrice?: number, notes?: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Holding not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { quantity, avgBuyPrice, currency, notes } = body as {
      quantity?: number;
      avgBuyPrice?: number;
      currency?: string;
      notes?: string;
    };

    // Validate inputs if provided
    const updates: Record<string, unknown> = {};

    if (quantity !== undefined) {
      if (typeof quantity !== "number" || quantity <= 0) {
        return NextResponse.json(
          { error: "Quantity must be a positive number" },
          { status: 400 }
        );
      }
      updates.quantity = quantity;
    }

    if (avgBuyPrice !== undefined) {
      if (typeof avgBuyPrice !== "number" || avgBuyPrice <= 0) {
        return NextResponse.json(
          { error: "Average buy price must be a positive number" },
          { status: 400 }
        );
      }
      updates.avg_buy_price = avgBuyPrice;
    }

    if (currency !== undefined) {
      const ALLOWED = ["USD", "INR", "EUR", "GBP"] as const;
      const upper = currency ? currency.toUpperCase() : null;
      if (upper && !ALLOWED.includes(upper as typeof ALLOWED[number])) {
        return NextResponse.json(
          { error: "Invalid currency" },
          { status: 400 }
        );
      }
      updates.currency = upper;
    }

    if (notes !== undefined) {
      updates.notes = notes || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("portfolio_holdings")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "Failed to update holding" },
        { status: 500 }
      );
    }

    // Fetch current price for P&L
    let currentPrice = 0;
    try {
      const quote = await fetchQuote(updated.symbol);
      currentPrice = quote?.price ?? 0;
    } catch {
      // If quote fails, return zero
    }

    const currentValue = currentPrice * updated.quantity;
    const investedValue = updated.avg_buy_price * updated.quantity;
    const pnl = currentValue - investedValue;
    const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

    return NextResponse.json({
      holding: {
        ...updated,
        currentPrice,
        currentValue,
        pnl,
        pnlPercent,
      },
    });
  } catch (error) {
    console.error("PUT /api/portfolio/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portfolio/[id] - Remove a portfolio holding.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from("portfolio_holdings")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Holding not found" },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabase
      .from("portfolio_holdings")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete holding" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/portfolio/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
