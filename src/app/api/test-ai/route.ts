import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mistralKey = process.env.MISTRAL_API_KEY;

  return NextResponse.json({
    mistral: {
      configured: !!mistralKey,
    },
  });
}
