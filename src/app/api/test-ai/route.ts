import { NextResponse } from "next/server";

/**
 * Diagnostic endpoint for AI provider env status.
 */
export async function GET() {
  const mistralKey = process.env.MISTRAL_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

  return NextResponse.json({
    providers: {
      mistral: {
        keyExists: !!mistralKey,
        keyLength: mistralKey?.length || 0,
      },
      googleGemini: {
        keyExists: !!googleKey,
        keyLength: googleKey?.length || 0,
      },
    },
    timestamp: new Date().toISOString(),
  });
}
