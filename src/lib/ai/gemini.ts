import { GoogleGenerativeAI } from '@google/generative-ai';
import { textToStream } from './mistral'; // Reuse the stream converter

const GEMINI_MODEL = "gemini-1.5-flash"; // Stable model

function readGeminiApiKey(): string {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
}

export function validateGeminiSetup(): { valid: boolean; error?: string } {
  const apiKey = readGeminiApiKey();
  if (!apiKey) {
    return { valid: false, error: "GOOGLE_API_KEY or GEMINI_API_KEY environment variable is not set" };
  }
  return { valid: true };
}

export async function generateGeminiResponse(
  message: string,
  context: {
    systemPrompt: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }
) {
  const apiKey = readGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API key not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const contents = [
    { role: "user", parts: [{ text: context.systemPrompt }] },
    ...(context.history || []).map(h => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }]
    })),
    { role: "user", parts: [{ text: message }] }
  ];

  const generationConfig = {
    temperature: context.temperature || 0.7,
    maxOutputTokens: context.maxTokens || 2048,
  };

  const result = await model.generateContent({
    contents,
    generationConfig,
  });

  return result.response.text();
}

export async function streamGeneralChat(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  kind: "brief" | "normal",
  userMemory?: string
): Promise<ReadableStream<Uint8Array>> {
  const systemPrompt = kind === "brief"
    ? "You are AlphaSight AI, a friendly and knowledgeable financial assistant. Be brief and friendly. Always be truthful, no assumptions."
    : "You are AlphaSight AI, a friendly and knowledgeable financial assistant. Be engaging, friendly, and conversational. Explain simply. Always be truthful, no assumptions.";

  const context = {
    systemPrompt: userMemory ? `${systemPrompt}\n\nUser context: ${userMemory}` : systemPrompt,
    history,
    temperature: 0.7,
    maxTokens: kind === "brief" ? 512 : 2048,
  };

  const text = await generateGeminiResponse(message, context);
  return textToStream(text);
}

export async function streamStockAnalysis(
  message: string,
  analysis: any,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMemory?: string
): Promise<ReadableStream<Uint8Array>> {
  // For stock, use Gemini if needed, but user said Mistral for complex
  // Perhaps not implement, or throw error
  throw new Error("Gemini not configured for stock analysis");
}

export function friendlyGeminiError(error: any): string {
  if (error?.message?.includes("API key")) {
    return "Gemini API key is not configured";
  }
  return "Gemini service is temporarily unavailable";
}

export async function generateDailyBrief(prompt: string): Promise<string> {
  const context = {
    systemPrompt: "Generate a concise daily portfolio brief in markdown format.",
    temperature: 0.6,
    maxTokens: 1500,
  };

  return await generateGeminiResponse(prompt, context);
}