import Groq from 'groq-sdk';
import { textToStream } from './mistral'; // Reuse the stream converter

const GROQ_MODEL = "llama-3.1-8b-instant"; // Use this model

function readGroqApiKey(): string {
  return process.env.GROQ_API_KEY || "";
}

export function validateGroqSetup(): { valid: boolean; error?: string } {
  const apiKey = readGroqApiKey();
  if (!apiKey) {
    return { valid: false, error: "GROQ_API_KEY environment variable is not set" };
  }
  return { valid: true };
}

export async function generateGroqResponse(
  message: string,
  context: {
    systemPrompt: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }
) {
  const apiKey = readGroqApiKey();
  if (!apiKey) throw new Error("Groq API key not configured");

  const groq = new Groq({ apiKey });

  const messages: any = [
    { role: "system", content: context.systemPrompt },
    ...(context.history || []).map(h => ({
      role: h.role as "user" | "assistant",
      content: h.content
    })),
    { role: "user", content: message }
  ];

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages,
    temperature: context.temperature || 0.7,
    max_tokens: context.maxTokens || 2048,
  });

  return completion.choices[0]?.message?.content || "";
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

  const text = await generateGroqResponse(message, context);
  return textToStream(text);
}

export async function streamStockAnalysis(
  message: string,
  analysis: any,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMemory?: string
): Promise<ReadableStream<Uint8Array>> {
  // Groq as fallback for stock
  const systemPrompt = "You are AlphaSight AI, a friendly and knowledgeable financial assistant. Provide stock analysis based on the provided data. Always be truthful, no assumptions.";

  const context = {
    systemPrompt: userMemory ? `${systemPrompt}\n\nUser context: ${userMemory}` : systemPrompt,
    history,
    temperature: 0.6,
    maxTokens: 4096,
  };

  const text = await generateGroqResponse(message, context);
  return textToStream(text);
}

export function friendlyGroqError(error: any): string {
  if (error?.message?.includes("API key")) {
    return "Groq API key is not configured";
  }
  return "Groq service is temporarily unavailable";
}

export async function generateDailyBrief(prompt: string): Promise<string> {
  const context = {
    systemPrompt: "Generate a concise daily portfolio brief in markdown format.",
    temperature: 0.6,
    maxTokens: 1500,
  };

  return await generateGroqResponse(prompt, context);
}