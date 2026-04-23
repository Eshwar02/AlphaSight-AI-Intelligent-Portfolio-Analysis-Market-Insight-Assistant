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
}

export function validateAiSetup(): {
  valid: boolean;
  error?: string;
  primary: "mistral" | "none";
  auxiliary: "gemini" | "none";
} {
  const mistral = validateMistralSetup();
  const gemini = validateGeminiSetup();

  if (!mistral.valid) {
    return {
      valid: false,
      primary: "none",
      auxiliary: gemini.valid ? "gemini" : "none",
      error: `Mistral is not configured: ${mistral.error}`,
    };
  }

  return {
    valid: true,
    primary: "mistral",
    auxiliary: gemini.valid ? "gemini" : "none",
  };
}

export async function streamChat(
  args: StreamChatArgs
): Promise<ReadableStream<Uint8Array>> {
  const setup = validateAiSetup();
  if (!setup.valid) throw new Error(setup.error ?? "Mistral is not configured");

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
