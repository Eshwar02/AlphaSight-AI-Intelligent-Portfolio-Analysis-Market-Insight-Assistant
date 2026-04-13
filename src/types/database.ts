export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: "user" | "assistant";
          content?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          }
        ];
      };
      portfolio_holdings: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          quantity: number;
          avg_buy_price: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          quantity: number;
          avg_buy_price: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          symbol?: string;
          quantity?: number;
          avg_buy_price?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      watchlist: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          added_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          added_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          symbol?: string;
          added_at?: string;
        };
        Relationships: [];
      };
      daily_briefs: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          portfolio_snapshot: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          portfolio_snapshot: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string;
          portfolio_snapshot?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          default_market: "US" | "IN";
          theme: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          default_market?: "US" | "IN";
          theme?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          default_market?: "US" | "IN";
          theme?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      message_role: "user" | "assistant";
      market_type: "US" | "IN";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ── Convenience aliases ──────────────────────────────────────────────

export type Conversation =
  Database["public"]["Tables"]["conversations"]["Row"];
export type ConversationInsert =
  Database["public"]["Tables"]["conversations"]["Insert"];
export type ConversationUpdate =
  Database["public"]["Tables"]["conversations"]["Update"];

export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type MessageInsert =
  Database["public"]["Tables"]["messages"]["Insert"];
export type MessageUpdate =
  Database["public"]["Tables"]["messages"]["Update"];

export type PortfolioHoldingRow =
  Database["public"]["Tables"]["portfolio_holdings"]["Row"];
export type PortfolioHoldingInsert =
  Database["public"]["Tables"]["portfolio_holdings"]["Insert"];
export type PortfolioHoldingUpdate =
  Database["public"]["Tables"]["portfolio_holdings"]["Update"];

export type WatchlistItem =
  Database["public"]["Tables"]["watchlist"]["Row"];
export type WatchlistInsert =
  Database["public"]["Tables"]["watchlist"]["Insert"];

export type DailyBriefRow =
  Database["public"]["Tables"]["daily_briefs"]["Row"];
export type DailyBriefInsert =
  Database["public"]["Tables"]["daily_briefs"]["Insert"];

export type UserPreferences =
  Database["public"]["Tables"]["user_preferences"]["Row"];
export type UserPreferencesInsert =
  Database["public"]["Tables"]["user_preferences"]["Insert"];
export type UserPreferencesUpdate =
  Database["public"]["Tables"]["user_preferences"]["Update"];
