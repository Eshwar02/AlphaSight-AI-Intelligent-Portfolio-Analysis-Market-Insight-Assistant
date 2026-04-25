import type { StockAnalysis } from "@/types/stock";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const MAX_RETRIES = 1;

type ChatRole = "user" | "assistant";

interface GroqMessage {
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
  return normalizeApiKey(process.env.GROQ_API_KEY);
}

export function validateGroqSetup(): { valid: boolean; error?: string } {
  const apiKey = readApiKey();
  if (!apiKey) {
    return { valid: false, error: "GROQ_API_KEY environment variable is not set" };
  }
  return { valid: true };
}

export function friendlyGroqError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const short = raw.replace(/\s+/g, " ").slice(0, 300);
  if (/401|invalid api key|unauthorized/i.test(raw)) {
    return `Groq rejected the API key. Check GROQ_API_KEY. Details: ${short}`;
  }
  if (/429|rate limit|quota/i.test(raw)) {
    return `Groq rate limit reached. Please wait a minute and retry. Details: ${short}`;
  }
  if (/5\d\d|server error|bad gateway/i.test(raw)) {
    return `Groq server error. Try again shortly. Details: ${short}`;
  }
  return `Groq error: ${short}`;
}

const HISTORY_MSG_CHAR_CAP = 500;

function buildMessages(
  systemPrompt: string,
  latestPrompt: string,
  history: Array<{ role: ChatRole; content: string }>
): GroqMessage[] {
  const trimmedHistory = history.slice(-4).map((m) => {
    const content =
      m.content.length > HISTORY_MSG_CHAR_CAP
        ? m.content.slice(0, HISTORY_MSG_CHAR_CAP) + " …[truncated]"
        : m.content;
    return { role: m.role, content };
  }) as GroqMessage[];

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
  let lastError: unknown = new Error("Unknown Groq error");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok || !isRetryableError(await response.text())) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err)) break;
    }

    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw lastError;
}

async function generateResponse(
  prompt: string,
  context: GenerateResponseContext
): Promise<ReadableStream<Uint8Array> | string> {
  const apiKey = readApiKey();
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const messages = buildMessages(context.systemPrompt, prompt, context.history ?? []);

  const payload = {
    model: context.model ?? "llama3-8b-8192",
    messages,
    stream: context.stream ?? false,
    temperature: context.temperature ?? 0.6,
    max_tokens: context.maxTokens ?? 4096,
  };

  const response = await fetchWithRetry(payload, context.timeoutMs ?? 60000, apiKey);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  if (!context.stream) {
    const data = await response.json();
    return data.choices[0]?.message?.content ?? "";
  }

  return response.body as ReadableStream<Uint8Array>;
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

function buildStockContext(analysis: StockAnalysis): string {
  const quote = analysis.quote;
  const technicals = analysis.technicals;
  const news = analysis.news.slice(0, 3);
  const macro = analysis.macroRisks.slice(0, 3);
  const raw = analysis.rawMaterialRisks.slice(0, 3);
  const company = analysis.companyInfo;

  return `
Stock Quote: ${quote.symbol} - ${quote.name}
Price: ${quote.price} ${quote.currency}
Change: ${quote.change} (${quote.changePercent}%)
Volume: ${quote.volume}
Market Cap: ${quote.marketCap}
P/E: ${quote.pe}
52W High/Low: ${quote.high52}/${quote.low52}

Technicals:
- RSI: ${technicals.rsi?.toFixed(2) ?? 'N/A'}
- MACD: ${technicals.macd?.macdLine?.toFixed(2) ?? 'N/A'}
- Moving Averages: 20d ${technicals.sma20?.toFixed(2)}, 50d ${technicals.sma50?.toFixed(2)}
- Trend: ${technicals.trend ?? 'N/A'}

Recent News (${news.length} items):
${news.map(n => `- ${n.title} (${new Date(n.publishedAt).toLocaleDateString()})`).join('\n')}

Macro Risks:
${macro.map(r => `- ${r}`).join('\n')}

Raw Material Risks:
${raw.map(r => `- ${r}`).join('\n')}

Company Info:
- Sector: ${company?.sector ?? 'N/A'}
- Industry: ${company?.industry ?? 'N/A'}
- Employees: ${company?.employees ?? 'N/A'}
- Website: ${company?.website ?? 'N/A'}
- Country: ${company?.country ?? 'N/A'}
- Description: ${company?.description?.slice(0, 300) ?? 'N/A'}
  `.trim();
}

export async function streamStockAnalysis(
  message: string,
  analysis: StockAnalysis,
  conversationHistory: Array<{ role: ChatRole; content: string }>,
  userMemory?: string
): Promise<ReadableStream<Uint8Array>> {
  const stockContext = buildStockContext(analysis);
  const systemPrompt = [
    `You are AlphaSight AI. Generate responses using CLEAN, MINIMAL MARKDOWN optimized for real-time rendering. Formatting rules: Use # for main section titles, ## for subsections, **bold** for key terms, - for lists. Keep concise.`,
    stockContext,
    userMemory,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");
  const stream = await generateResponse(message, {
    systemPrompt,
    history: conversationHistory,
    model: "llama3-8b-8192",
    stream: true,
    temperature: 0.6,
    maxTokens: 8192,
    timeoutMs: 120_000,
  });
  return typeof stream === "string" ? textToStream(stream) : stream;
}

export async function streamGeneralChat(
  message: string,
  conversationHistory: Array<{ role: ChatRole; content: string }>,
  kind: "brief" | "normal" = "normal",
  userMemory?: string
): Promise<ReadableStream<Uint8Array>> {
  const basePrompt = `You are AlphaSight AI, a clear and helpful assistant. Generate responses in clean structured plain text. Use natural text, short paragraphs. Style: Match user intent, concise. Friendly, explanatory. Always provide info; never say no. Finance: Explain without inventing data.`;
  const systemPrompt = userMemory
    ? `${basePrompt}\n\n---\n\n${userMemory}`
    : basePrompt;
  const stream = await generateResponse(message, {
    systemPrompt,
    history: conversationHistory,
    model: "llama3-8b-8192",
    stream: true,
    temperature: kind === "brief" ? 0.8 : 0.6,
    maxTokens: kind === "brief" ? 140 : 8192,
    timeoutMs: 120_000,
  });
  return typeof stream === "string" ? textToStream(stream) : stream;
}

export async function generateDailyBrief(prompt: string): Promise<string> {
  try {
    const stream = await generateResponse(prompt, {
      systemPrompt: `You are AlphaSight AI generating a professional-grade daily portfolio brief. Format responses using SIMPLE MARKDOWN. Keep under 800 words. Be professional, data-driven.`,
      model: "llama3-8b-8192",
      stream: false,
      temperature: 0.6,
      maxTokens: 4096,
      timeoutMs: 120_000,
    });
    return typeof stream === "string" ? stream : "Unable to generate brief.";
  } catch (err) {
    console.error("Groq daily brief error:", err);
    return "Unable to generate brief right now.";
  }
}