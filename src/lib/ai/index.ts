import type { StockAnalysis } from "@/types/stock";
import {
  streamStockAnalysis as mistralStockStream,
  streamGeneralChat as mistralGeneralStream,
  validateMistralSetup,
  friendlyMistralError,
  generateDailyBrief as mistralGenerateDailyBrief,
} from "./mistral";

type ChatRole = "user" | "assistant";
type ChatHistory = Array<{ role: ChatRole; content: string }>;

export type ChatMode = "stock" | "general";

interface StreamChatArgs {
  mode: ChatMode;
  message: string;
  history: ChatHistory;
  analysis?: StockAnalysis;
  kind?: "brief" | "normal";
  model?: "mistral";
}

export function validateAiSetup(): {
  valid: boolean;
  error?: string;
  primary: "mistral" | "none";
  auxiliary: "none";
} {
  const mistral = validateMistralSetup();

  if (mistral.valid) {
    return {
      valid: true,
      primary: "mistral",
      auxiliary: "none",
    };
  }
  return {
    valid: false,
    primary: "none",
    auxiliary: "none",
    error: `No LLM configured. Mistral: ${mistral.error}`,
  };
}

export async function streamChat(
  args: StreamChatArgs
): Promise<ReadableStream<Uint8Array>> {
  const mistralOk = validateMistralSetup().valid;

  if (!mistralOk) {
    throw new Error("No LLM provider is configured (need MISTRAL_API_KEY)");
  }

  if (args.mode === "stock") {
    if (!args.analysis) throw new Error("Stock mode requires analysis data");
    return mistralStockStream(args.message, args.analysis, args.history);
  }
  return mistralGeneralStream(args.message, args.history, args.kind ?? "normal");
}

export async function generateDailyBrief(prompt: string): Promise<string> {
  const setup = validateAiSetup();
  if (!setup.valid) {
    return `Unable to generate brief. ${setup.error ?? "No AI provider configured."}`;
  }

  const mistralText = await mistralGenerateDailyBrief(prompt);
  if (mistralText && !/^Unable to generate brief/i.test(mistralText)) {
    return mistralText;
  }

  return mistralText || "Unable to generate brief right now.";
}

export async function classifyIntent(message: string): Promise<{
  intent: string;
  company_name: string | null;
  symbols: string[];
  query_type: string;
} | null> {
  const text = message.trim();
  if (!text) return null;

  if (/^(hi|hey|hello|yo|thanks|thank you|bye|ok|okay)$/i.test(text)) {
    return {
      intent: "greeting",
      company_name: null,
      symbols: [],
      query_type: "general",
    };
  }

  const tickerMatch = text.match(/\$?([A-Z]{1,10}(?:\.[A-Z]{1,2})?)\b/);
  if (tickerMatch) {
    return {
      intent: "stock_query",
      company_name: null,
      symbols: [tickerMatch[1].toUpperCase()],
      query_type: "analysis",
    };
  }

  if (/\b(analyze|analysis|stock|share|price|quote|buy|sell|target)\b/i.test(text)) {
    return {
      intent: "stock_query",
      company_name: text,
      symbols: [],
      query_type: "analysis",
    };
  }

  return {
    intent: "general_finance",
    company_name: null,
    symbols: [],
    query_type: "general",
  };
}
