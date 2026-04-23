import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/";

  // Handle auth callback
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] Session exchange failed:", error);
      return NextResponse.redirect(
        new URL("/login?error=auth_callback_failed", origin)
      );
    }

    // Get authenticated user and sync profile
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      try {
        // Ensure user preferences exist
        const { data: existingPrefs } = await supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (!existingPrefs) {
          // Create default preferences for new user
          const { error: prefError } = await supabase
            .from("user_preferences")
            .insert({
              user_id: user.id,
              default_market: "US",
              theme: "dark",
            });

          if (prefError) {
            console.error("[auth/callback] Failed to create user preferences:", prefError);
          }
        }
      } catch (error) {
        // Preferences table might not exist for guest users, continue anyway
        console.debug("[auth/callback] User profile sync skipped:", error);
      }
    }

    return NextResponse.redirect(new URL(redirect, origin));
  }

  // Missing code
  console.error("[auth/callback] Missing auth code");
  return NextResponse.redirect(
    new URL("/login?error=missing_code", origin)
  );
}

