import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const { data, error } = await supabase
      .from("user_memory")
      .select("key, value")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const memory: Record<string, string> = {};
    for (const m of data ?? []) {
      memory[m.key] = m.value;
    }

    return NextResponse.json({ memory });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}