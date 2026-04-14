import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.GROQ_API_KEY;

  return NextResponse.json({
    groqKeyExists: !!apiKey,
    groqKeyLength: apiKey?.length || 0,
    groqKeyStart: apiKey?.substring(0, 10) || "missing",
    timestamp: new Date().toISOString(),
  });
}
