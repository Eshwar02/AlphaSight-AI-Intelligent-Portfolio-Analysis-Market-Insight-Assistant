import type { StockAnalysis } from "@/types/stock";
import {
  streamStockAnalysis as mistralStockStream,
  streamGeneralChat as mistralGeneralStream,
  validateMistralSetup,
  friendlyMistralError,
  generateDailyBrief as mistralGenerateDailyBrief,
} from "./mistral";
import {
  validateGeminiSetup,
  classifyIntent as geminiClassifyIntent,
  generateDailyBrief as geminiGenerateDailyBrief,
  streamStockAnalysis as geminiStockStream,
  streamGeneralChat as geminiGeneralStream,
} from "./gemini";

type ChatRole = "user" | "assistant";
type ChatHistory = Array<{ role: ChatRole; content: string }>;

export type ChatMode = "stock" | "general";

interface StreamChatArgs {
  mode: ChatMode;
  message: string;
  history: ChatHistory;
  analysis?: StockAnalysis;
  kind?: "brief" | "normal";
  model?: "mistral" | "gemini";
}

export function validateAiSetup(): {
  valid: boolean;
  error?: string;
  primary: "mistral" | "gemini" | "none";
  auxiliary: "gemini" | "mistral" | "none";
} {
  const mistral = validateMistralSetup();
  const gemini = validateGeminiSetup();

  if (mistral.valid) {
    return {
      valid: true,
      primary: "mistral",
      auxiliary: gemini.valid ? "gemini" : "none",
    };
  }
  if (gemini.valid) {
    return {
      valid: true,
      primary: "gemini",
      auxiliary: "none",
    };
  }
  return {
    valid: false,
    primary: "none",
    auxiliary: "none",
    error: `No LLM configured. Mistral: ${mistral.error}. Gemini: ${gemini.error}`,
  };
}

export async function streamChat(
  args: StreamChatArgs
): Promise<ReadableStream<Uint8Array>> {
  const mistralOk = validateMistralSetup().valid;
  const geminiOk = validateGeminiSetup().valid;

  const preferGemini = args.model === "gemini" && geminiOk;
  const useGemini = preferGemini || (!mistralOk && geminiOk);

  if (!mistralOk && !geminiOk) {
    throw new Error("No LLM provider is configured (need MISTRAL_API_KEY or GOOGLE_API_KEY)");
  }

  if (args.mode === "stock") {
    if (!args.analysis) throw new Error("Stock mode requires analysis data");
    return useGemini
      ? geminiStockStream(args.message, args.analysis, args.history)
      : mistralStockStream(args.message, args.analysis, args.history);
  }
  return useGemini
    ? geminiGeneralStream(args.message, args.history)
    : mistralGeneralStream(args.message, args.history, args.kind ?? "normal");
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

  if (setup.auxiliary === "gemini") {
    try {
      return await geminiGenerateDailyBrief(prompt);
    } catch (error) {
      return `Unable to generate brief. ${friendlyMistralError(error)}`;
    }
  }

  return mistralText || "Unable to generate brief right now.";
}

export { geminiClassifyIntent as classifyIntent };
