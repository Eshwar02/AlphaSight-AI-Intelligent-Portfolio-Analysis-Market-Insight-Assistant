"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface UserProfile {
  user: User | null;
  preferences?: {
    default_market: "US" | "IN";
    theme: string;
  };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<{
    default_market: "US" | "IN";
    theme: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    // Get the initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        // Load user preferences
        loadUserPreferences(user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserPreferences(session.user.id);
      } else {
        setPreferences(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadUserPreferences(userId: string) {
    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("default_market, theme")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.debug("[useAuth] No preferences found, using defaults:", error.message);
        setPreferences({
          default_market: "US",
          theme: "dark",
        });
      } else if (data) {
        setPreferences(data);
      }
    } catch (err) {
      console.error("[useAuth] Failed to load preferences:", err);
      setPreferences({
        default_market: "US",
        theme: "dark",
      });
    } finally {
      setLoading(false);
    }
  }

  async function updatePreferences(updates: Partial<{
    default_market: "US" | "IN";
    theme: string;
  }>) {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_preferences")
        .update(updates)
        .eq("user_id", user.id);

      if (error) {
        console.error("[useAuth] Failed to update preferences:", error);
        return false;
      }

      setPreferences((prev) => (prev ? { ...prev, ...updates } : null));
      return true;
    } catch (err) {
      console.error("[useAuth] Unexpected error updating preferences:", err);
      return false;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setPreferences(null);
  }

  return { user, preferences, loading, signOut, updatePreferences };
}

