import { NextResponse } from "next/server";

/**
 * Legacy diagnostic endpoint — kept at the old path so existing bookmarks work.
 * Reports on the new Gemini API key (with fallback to the old GROQ_API_KEY env
 * var in case something still reads it during the migration).
 */
export async function GET() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  const legacyGroqKey = process.env.GROQ_API_KEY;

  return NextResponse.json({
    provider: "gemini",
    geminiKeyExists: !!apiKey,
    geminiKeyLength: apiKey?.length || 0,
    geminiKeyStart: apiKey?.substring(0, 6) || "missing",
    legacyGroqKeyStillSet: !!legacyGroqKey,
    timestamp: new Date().toISOString(),
  });
}
