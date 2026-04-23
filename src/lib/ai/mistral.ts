import {
  DAILY_BRIEF_PROMPT,
  GENERAL_CHAT_PROMPT,
  STOCK_ANALYSIS_SYSTEM_PROMPT,
} from "./prompts";
import type { StockAnalysis } from "@/types/stock";

const STOCK_ANALYSIS_MODEL = "mistral-large-latest";
const GENERAL_CHAT_MODEL = "mistral-small-latest";
const DAILY_BRIEF_MODEL = "mistral-large-latest";
const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";

const MAX_RETRIES = 1;

type ChatRole = "user" | "assistant";

interface MistralMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateResponseContext {
  systemPrompt: string;
  history?: Array<{ role: ChatRole; content: string }>;
  model?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

function normalizeApiKey(rawValue: string | undefined): string {
  const trimmed = rawValue?.trim() ?? "";
  if (!trimmed) return "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function readApiKey(): string {
  return normalizeApiKey(process.env.MISTRAL_API_KEY);
}

export function validateMistralSetup(): { valid: boolean; error?: string } {
  const apiKey = readApiKey();
  if (!apiKey) {
    return { valid: false, error: "MISTRAL_API_KEY environment variable is not set" };
  }
  if (apiKey.length < 20) {
    return { valid: false, error: "MISTRAL_API_KEY looks too short to be valid" };
  }
  return { valid: true };
}

export function friendlyMistralError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const short = raw.replace(/\s+/g, " ").slice(0, 300);
  if (/401|invalid api key|unauthorized/i.test(raw)) {
    return `Mistral rejected the API key. Check MISTRAL_API_KEY. Details: ${short}`;
  }
  if (/429|rate limit|quota/i.test(raw)) {
    return `Mistral rate limit reached. Please wait a minute and retry. Details: ${short}`;
  }
  if (/5\d\d|server error|bad gateway/i.test(raw)) {
    return `Mistral server error. Try again shortly. Details: ${short}`;
  }
  return `Mistral error: ${short}`;
}

function buildMessages(
  systemPrompt: string,
  latestPrompt: string,
  history: Array<{ role: ChatRole; content: string }>
): MistralMessage[] {
  const trimmedHistory = history.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  })) as MistralMessage[];

  return [
    { role: "system", content: systemPrompt },
    ...trimmedHistory,
    { role: "user", content: latestPrompt },
  ];
}

function isRetryableError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|network|fetch failed|429|5\d\d|ECONN|ENOTFOUND/i.test(raw);
}

async function fetchWithRetry(
  payload: Record<string, unknown>,
  timeoutMs: number,
  apiKey: string
): Promise<Response> {
  let lastError: unknown = new Error("Unknown Mistral error");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(MISTRAL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Accept: payload.stream ? "text/event-stream" : "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `Mistral HTTP ${response.status}${errorBody ? `: ${errorBody.slice(0, 400)}` : ""}`
        );
      }

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      const shouldRetry = attempt < MAX_RETRIES && isRetryableError(error);
      if (!shouldRetry) throw error;
    }
  }

  throw lastError;
}

function textToStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function parseNonStreamingText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const choices = (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

async function openStreamingResponse(response: Response): Promise<ReadableStream<Uint8Array>> {
  if (!response.body) throw new Error("Mistral response stream is missing body");
  const upstream = response.body;
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r\n/g, "\n");

          let eventEnd = buffer.indexOf("\n\n");
          while (eventEnd !== -1) {
            const rawEvent = buffer.slice(0, eventEnd);
            buffer = buffer.slice(eventEnd + 2);

            for (const line of rawEvent.split("\n")) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;

              try {
                const parsed = JSON.parse(payload) as {
                  choices?: Array<{ delta?: { content?: unknown } }>;
                };
                const delta = parsed.choices?.[0]?.delta?.content;
                if (typeof delta === "string" && delta.length > 0) {
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {
                // Keep stream alive on malformed keepalive chunks.
              }
            }

            eventEnd = buffer.indexOf("\n\n");
          }
        }

        // Process any trailing event block that may not end with double newline.
        if (buffer.trim().length > 0) {
          for (const line of buffer.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: unknown } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              // ignore malformed trailing payload
            }
          }
        }
      } catch (error) {
        controller.error(error);
        return;
      } finally {
        reader.releaseLock();
      }

      controller.close();
    },
  });
}

function formatLargeNumber(value: number): string {
  if (value >= 1e12) return (value / 1e12).toFixed(2) + "T";
  if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
  if (value >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (value >= 1e3) return (value / 1e3).toFixed(2) + "K";
  return value.toString();
}

function buildStockContext(analysis: StockAnalysis): string {
  const {
    quote,
    history,
    technicals,
    news,
    macroRisks,
    rawMaterialRisks,
    companyInfo,
  } = analysis;

  let context = `## Real-Time Data for ${quote.name} (${quote.symbol})\n\n`;
  context += `### Price & Market Data\n`;
  context += `- Current Price: ${quote.currency} ${quote.price.toFixed(2)}\n`;
  context += `- Change: ${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)\n`;
  context += `- Open: ${quote.currency} ${quote.open.toFixed(2)}\n`;
  context += `- Previous Close: ${quote.currency} ${quote.previousClose.toFixed(2)}\n`;
  context += `- Day Range: ${quote.dayLow.toFixed(2)} - ${quote.dayHigh.toFixed(2)}\n`;
  context += `- 52-Week Range: ${quote.low52.toFixed(2)} - ${quote.high52.toFixed(2)}\n`;
  context += `- Market Cap: ${quote.marketCap > 0 ? formatLargeNumber(quote.marketCap) : "N/A"}\n`;
  context += `- Volume: ${formatLargeNumber(quote.volume)}\n`;
  context += `- P/E Ratio: ${quote.pe !== null ? quote.pe.toFixed(2) : "N/A"}\n`;
  context += `- Exchange: ${quote.exchange}\n\n`;

  if (companyInfo) {
    context += `### Company Profile\n`;
    context += `- Sector: ${companyInfo.sector}\n`;
    context += `- Industry: ${companyInfo.industry}\n`;
    context += `- Country: ${companyInfo.country || "N/A"}\n`;
    if (companyInfo.website) context += `- Website: ${companyInfo.website}\n`;
    if (companyInfo.employees) {
      context += `- Employees: ${formatLargeNumber(companyInfo.employees)}\n`;
    }
    context += "\n";
  }

  if (history.length > 0) {
    context += `### Historical Performance\n`;
    context += `- Data Range: ${history[0].date} to ${history[history.length - 1].date}\n\n`;
  }

  context += `### Technical Indicators\n`;
  context += `- 20-day SMA: ${technicals.sma20 !== null ? technicals.sma20.toFixed(2) : "N/A"}\n`;
  context += `- 50-day SMA: ${technicals.sma50 !== null ? technicals.sma50.toFixed(2) : "N/A"}\n`;
  context += `- RSI (14): ${technicals.rsi !== null ? technicals.rsi.toFixed(2) : "N/A"}\n`;
  context += `- Trend Direction: ${technicals.trend.toUpperCase()}\n\n`;

  if (news.length > 0) {
    context += `### Recent News (${news.length} items)\n`;
    for (const item of news.slice(0, 8)) {
      context += `- ${item.title} — ${item.source} (${item.publishedAt.split("T")[0]})\n`;
    }
    context += "\n";
  }

  if (macroRisks.length > 0) {
    context += `### Macro Risks\n`;
    for (const risk of macroRisks) context += `- ${risk}\n`;
    context += "\n";
  }

  if (rawMaterialRisks.length > 0) {
    context += `### Raw Material Risks\n`;
    for (const risk of rawMaterialRisks) context += `- ${risk}\n`;
    context += "\n";
  }

  return context;
}

export async function generateResponse(
  prompt: string,
  context: GenerateResponseContext
): Promise<string | ReadableStream<Uint8Array>> {
  const apiKey = readApiKey();
  if (!apiKey) throw new Error("MISTRAL_API_KEY not set");

  const payload = {
    model: context.model ?? GENERAL_CHAT_MODEL,
    messages: buildMessages(context.systemPrompt, prompt, context.history ?? []),
    temperature: context.temperature ?? 0.6,
    max_tokens: context.maxTokens ?? 2048,
    stream: Boolean(context.stream),
  };

  const response = await fetchWithRetry(payload, context.timeoutMs ?? 35_000, apiKey);

  if (context.stream) {
    return openStreamingResponse(response);
  }

  const parsed = await response.json().catch(() => null);
  return parseNonStreamingText(parsed);
}

export async function streamStockAnalysis(
  message: string,
  analysis: StockAnalysis,
  conversationHistory: Array<{ role: ChatRole; content: string }>
): Promise<ReadableStream<Uint8Array>> {
  const stockContext = buildStockContext(analysis);
  const stream = await generateResponse(message, {
    systemPrompt: `${STOCK_ANALYSIS_SYSTEM_PROMPT}\n\n---\n\n${stockContext}`,
    history: conversationHistory,
    model: STOCK_ANALYSIS_MODEL,
    stream: true,
    temperature: 0.6,
    maxTokens: 4096,
    timeoutMs: 45_000,
  });
  return typeof stream === "string" ? textToStream(stream) : stream;
}

export async function streamGeneralChat(
  message: string,
  conversationHistory: Array<{ role: ChatRole; content: string }>,
  kind: "brief" | "normal" = "normal"
): Promise<ReadableStream<Uint8Array>> {
  const stream = await generateResponse(message, {
    systemPrompt: GENERAL_CHAT_PROMPT,
    history: conversationHistory,
    model: GENERAL_CHAT_MODEL,
    stream: true,
    temperature: kind === "brief" ? 0.8 : 0.6,
    maxTokens: kind === "brief" ? 256 : 3072,
    timeoutMs: 45_000,
  });
  return typeof stream === "string" ? textToStream(stream) : stream;
}

export async function generateDailyBrief(prompt: string): Promise<string> {
  try {
    const result = await generateResponse(prompt, {
      systemPrompt: DAILY_BRIEF_PROMPT,
      model: DAILY_BRIEF_MODEL,
      stream: false,
      temperature: 0.6,
      maxTokens: 2048,
      timeoutMs: 35_000,
    });
    return typeof result === "string" ? result : "";
  } catch (error) {
    return `Unable to generate brief. ${friendlyMistralError(error)}`;
  }
}
