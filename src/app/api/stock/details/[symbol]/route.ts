import { NextRequest, NextResponse } from "next/server";
import { fetchQuote, fetchHistory, fetchCompanyInfo } from "@/lib/stock/data";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    if (!symbol) {
      return NextResponse.json({ error: "Symbol required" }, { status: 400 });
    }

    // Fetch data in parallel
    const [quote, history, info] = await Promise.all([
      fetchQuote(symbol).catch(() => null),
      fetchHistory(symbol, 10, new Date("2020-01-01")).catch(() => []),
      fetchCompanyInfo(symbol).catch(() => null),
    ]);

    return NextResponse.json({
      quote,
      history,
      info,
    });
  } catch (err) {
    console.error("Stock details error:", err);
    return NextResponse.json({ error: "Failed to fetch details" }, { status: 500 });
  }
}