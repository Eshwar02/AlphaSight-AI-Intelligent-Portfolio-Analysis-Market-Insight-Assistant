import type { StockAnalysis } from "@/types/stock";
import {
  streamStockAnalysis as mistralStockStream,
  streamGeneralChat as mistralGeneralStream,
  validateMistralSetup,
  friendlyMistralError,
  generateDailyBrief as mistralGenerateDailyBrief,
} from "./mistral";
import {
  streamStockAnalysis as groqStockStream,
  streamGeneralChat as groqGeneralStream,
  validateGroqSetup,
  friendlyGroqError,
  generateDailyBrief as groqGenerateDailyBrief,
} from "./groq";

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
  userMemory?: string;
}

export function validateAiSetup(): {
  valid: boolean;
  error?: string;
  primary: "mistral" | "groq" | "none";
  auxiliary: "groq" | "mistral" | "none";
} {
  const mistral = validateMistralSetup();
  const groq = validateGroqSetup();

  if (mistral.valid) {
    return {
      valid: true,
      primary: "mistral",
      auxiliary: groq.valid ? "groq" : "none",
    };
  }
  if (groq.valid) {
    return {
      valid: true,
      primary: "groq",
      auxiliary: "none",
    };
  }
  return {
    valid: false,
    primary: "none",
    auxiliary: "none",
    error: `No LLM configured. Mistral: ${mistral.error}, Groq: ${groq.error}`,
  };
}

export async function streamChat(
  args: StreamChatArgs
): Promise<ReadableStream<Uint8Array>> {
  const setup = validateAiSetup();
  if (!setup.valid) {
    throw new Error("No LLM provider is configured");
  }

  const tryProviders = setup.primary === "mistral" ? ["mistral", "groq"] : ["groq", "mistral"];

  for (const provider of tryProviders) {
    if (provider === "none") continue;
    try {
      if (args.mode === "stock") {
        if (!args.analysis) throw new Error("Stock mode requires analysis data");
        if (provider === "mistral") {
          return mistralStockStream(
            args.message,
            args.analysis,
            args.history,
            args.userMemory
          );
        } else {
          return groqStockStream(
            args.message,
            args.analysis,
            args.history,
            args.userMemory
          );
        }
      } else {
        if (provider === "mistral") {
          return mistralGeneralStream(
            args.message,
            args.history,
            args.kind ?? "normal",
            args.userMemory
          );
        } else {
          return groqGeneralStream(
            args.message,
            args.history,
            args.kind ?? "normal",
            args.userMemory
          );
        }
      }
    } catch (err) {
      console.warn(`Provider ${provider} failed:`, err);
      continue;
    }
  }

  throw new Error("All LLM providers failed");
}

export async function generateDailyBrief(prompt: string): Promise<string> {
  const setup = validateAiSetup();
  if (!setup.valid) {
    return `Unable to generate brief. ${setup.error ?? "No AI provider configured."}`;
  }

  const providers = setup.primary === "mistral" ? ["mistral", "groq"] : ["groq", "mistral"];

  for (const provider of providers) {
    try {
      const text = provider === "mistral"
        ? await mistralGenerateDailyBrief(prompt)
        : await groqGenerateDailyBrief(prompt);
      if (text && !/^Unable to generate brief/i.test(text)) {
        return text;
      }
    } catch (err) {
      console.warn(`Daily brief provider ${provider} failed:`, err);
    }
  }

  return "Unable to generate brief right now.";
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
