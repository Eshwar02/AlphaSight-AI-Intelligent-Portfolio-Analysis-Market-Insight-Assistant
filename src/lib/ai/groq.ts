import Groq from "groq-sdk";
import { STOCK_ANALYSIS_SYSTEM_PROMPT, GENERAL_CHAT_PROMPT, DAILY_BRIEF_PROMPT } from "./prompts";
import type { StockAnalysis } from "@/types/stock";

let groqClient: Groq | null = null;

function normalizeApiKey(rawValue: string | undefined): string {
  const trimmed = rawValue?.trim() ?? "";
  if (!trimmed) return "";

  const wrappedInDoubleQuotes =
    trimmed.startsWith('"') && trimmed.endsWith('"');
  const wrappedInSingleQuotes =
    trimmed.startsWith("'") && trimmed.endsWith("'");

  if (wrappedInDoubleQuotes || wrappedInSingleQuotes) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export function validateGroqSetup(): { valid: boolean; error?: string } {
  const rawKey = process.env.GROQ_API_KEY;
  const apiKey = normalizeApiKey(rawKey);

  if (!apiKey) {
    return {
      valid: false,
      error: "GROQ_API_KEY environment variable is not set",
    };
  }

  if (!apiKey.startsWith("gsk_")) {
    return {
      valid: false,
      error: "GROQ_API_KEY does not appear to be valid (should start with 'gsk_')",
    };
  }

  return { valid: true };
}

function getGroqClient(): Groq {
  if (groqClient) return groqClient;

  const validation = validateGroqSetup();
  if (!validation.valid) {
    throw new Error(validation.error || "Groq API not configured");
  }

  const apiKey = normalizeApiKey(process.env.GROQ_API_KEY);
  console.log("[Groq] Initializing client");
  groqClient = new Groq({ apiKey });
  return groqClient;
}

// Model priority: try the best available model first, fall back to smaller ones
const MODEL_PRIORITY = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
] as const;

// Cache the working model after first successful call
let workingModel: string | null = null;

async function getWorkingModel(client: Groq): Promise<string> {
  if (workingModel) return workingModel;

  for (const model of MODEL_PRIORITY) {
    try {
      await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
        stream: false,
      });
      workingModel = model;
      console.log(`[Groq] Using model: ${model}`);
      return model;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403 || status === 400) {
        console.warn(`[Groq] Model ${model} unavailable (${status}), trying next...`);
        continue;
      }
      // For other errors (rate limit, network), use this model anyway
      workingModel = model;
      return model;
    }
  }

  // Final fallback
  workingModel = "llama-3.1-8b-instant";
  return workingModel;
}

// Synchronous getter that returns cached model or default
function getModel(): string {
  return workingModel || "llama-3.1-8b-instant";
}

/**
 * Classify user intent using LLM. Used as a fallback when regex detection fails.
 * Uses the fast 8b model with minimal tokens for speed.
 */
export async function classifyIntent(
  message: string
): Promise<{
  intent: string;
  company_name: string | null;
  symbols: string[];
  query_type: string;
} | null> {
  try {
    const client = getGroqClient();
    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You are a financial query classifier. Determine if the user is asking about a specific stock or company. Respond ONLY with valid JSON, nothing else.`,
        },
        {
          role: "user",
          content: `Classify: "${message}"

JSON format:
{"intent":"stock_query"|"general_finance"|"greeting"|"comparison"|"market_overview"|"other","company_name":"name or null","symbols":["TICKER"],"query_type":"analysis"|"price"|"news"|"comparison"|"general"}

Rules:
- If user mentions ANY company or stock by name, intent=stock_query and include company_name
- "reliance" = Reliance Industries, "tcs" = TCS, "apple" = Apple Inc, etc.
- If it's a greeting or off-topic, intent=other
- For general finance questions (what is PE ratio), intent=general_finance`,
        },
      ],
      temperature: 0,
      max_tokens: 120,
      stream: false,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("[classifyIntent] Failed:", err);
    return null;
  }
}

/**
 * Build a comprehensive context string from a StockAnalysis object for the LLM.
 * Includes price data, company profile, historical performance, technicals, news, and risks.
 */
function buildStockContext(analysis: StockAnalysis): string {
  const { quote, history, technicals, news, macroRisks, rawMaterialRisks, companyInfo } = analysis;

  let context = `## Real-Time Data for ${quote.name} (${quote.symbol})\n\n`;

  // ── Price & Market Data ──
  context += `### Price & Market Data\n`;
  context += `- Current Price: ${quote.currency} ${quote.price.toFixed(2)}\n`;
  context += `- Change: ${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)\n`;
  context += `- Open: ${quote.currency} ${quote.open.toFixed(2)}\n`;
  context += `- Previous Close: ${quote.currency} ${quote.previousClose.toFixed(2)}\n`;
  context += `- Day Range: ${quote.dayLow.toFixed(2)} - ${quote.dayHigh.toFixed(2)}\n`;
  context += `- 52-Week Range: ${quote.low52.toFixed(2)} - ${quote.high52.toFixed(2)}\n`;
  const pctFrom52High = quote.high52 > 0 ? (((quote.price - quote.high52) / quote.high52) * 100).toFixed(1) : "N/A";
  const pctFrom52Low = quote.low52 > 0 ? (((quote.price - quote.low52) / quote.low52) * 100).toFixed(1) : "N/A";
  context += `- Position in 52-Week Range: ${pctFrom52High}% from high, +${pctFrom52Low}% from low\n`;
  context += `- Market Cap: ${quote.marketCap > 0 ? formatLargeNumber(quote.marketCap) : "N/A"}\n`;
  context += `- Volume: ${formatLargeNumber(quote.volume)}\n`;
  context += `- P/E Ratio: ${quote.pe !== null ? quote.pe.toFixed(2) : "N/A"}\n`;
  context += `- Exchange: ${quote.exchange}\n\n`;

  // ── Company Profile ──
  if (companyInfo) {
    context += `### Company Profile\n`;
    context += `- Sector: ${companyInfo.sector}\n`;
    context += `- Industry: ${companyInfo.industry}\n`;
    context += `- Country: ${companyInfo.country || "N/A"}\n`;
    if (companyInfo.website) context += `- Website: ${companyInfo.website}\n`;
    if (companyInfo.employees) context += `- Employees: ${formatLargeNumber(companyInfo.employees)}\n`;
    if (companyInfo.description) {
      const desc = companyInfo.description.length > 800
        ? companyInfo.description.substring(0, 797) + "..."
        : companyInfo.description;
      context += `- Business Description: ${desc}\n`;
    }
    context += "\n";
  }

  // ── Historical Performance ──
  if (history.length > 0) {
    context += `### Historical Performance\n`;
    const histLen = history.length;
    const oldestDate = history[0].date;
    const newestDate = history[histLen - 1].date;
    const oldestClose = history[0].close;
    const newestClose = history[histLen - 1].close;
    context += `- Data Range: ${oldestDate} to ${newestDate} (${histLen} trading days)\n`;

    // Multi-period returns
    const periods = [
      { label: "1 Month", days: 22 },
      { label: "3 Months", days: 66 },
      { label: "6 Months", days: 132 },
      { label: "1 Year", days: 252 },
      { label: "3 Years", days: 756 },
      { label: "5 Years", days: 1260 },
    ];
    for (const p of periods) {
      if (histLen >= p.days) {
        const pastClose = history[histLen - p.days].close;
        if (pastClose > 0) {
          const ret = ((newestClose - pastClose) / pastClose * 100).toFixed(1);
          context += `- ${p.label} Return: ${Number(ret) >= 0 ? "+" : ""}${ret}%\n`;
        }
      }
    }

    // CAGR
    if (oldestClose > 0 && histLen > 252) {
      const years = histLen / 252;
      const cagr = (Math.pow(newestClose / oldestClose, 1 / years) - 1) * 100;
      context += `- Approximate CAGR (${years.toFixed(1)}yr): ${cagr.toFixed(2)}%\n`;
    }

    // Dataset high/low
    let datasetHigh = 0, athDate = "";
    let datasetLow = Infinity, atlDate = "";
    for (const h of history) {
      if (h.high > datasetHigh) { datasetHigh = h.high; athDate = h.date; }
      if (h.low < datasetLow && h.low > 0) { datasetLow = h.low; atlDate = h.date; }
    }
    context += `- All-Time High (in data): ${quote.currency} ${datasetHigh.toFixed(2)} on ${athDate}\n`;
    if (datasetLow < Infinity) {
      context += `- All-Time Low (in data): ${quote.currency} ${datasetLow.toFixed(2)} on ${atlDate}\n`;
    }

    // 30-day volume analysis
    const recent30 = history.slice(-30);
    const avgVol30 = recent30.length > 0
      ? Math.round(recent30.reduce((s, d) => s + d.volume, 0) / recent30.length)
      : 0;
    if (avgVol30 > 0) {
      context += `- Average Volume (30d): ${formatLargeNumber(avgVol30)}\n`;
      if (quote.volume > 0) {
        const volRatio = (quote.volume / avgVol30 * 100).toFixed(0);
        context += `- Today's Volume vs 30d Avg: ${volRatio}%\n`;
      }
    }
    context += "\n";
  }

  // ── Technical Indicators ──
  context += `### Technical Indicators\n`;
  context += `- 20-day SMA: ${technicals.sma20 !== null ? technicals.sma20.toFixed(2) : "N/A"}`;
  if (technicals.sma20 !== null) {
    const pctVsSma20 = ((quote.price - technicals.sma20) / technicals.sma20 * 100).toFixed(1);
    context += ` (price is ${Number(pctVsSma20) >= 0 ? "+" : ""}${pctVsSma20}% vs SMA20)`;
  }
  context += "\n";
  context += `- 50-day SMA: ${technicals.sma50 !== null ? technicals.sma50.toFixed(2) : "N/A"}`;
  if (technicals.sma50 !== null) {
    const pctVsSma50 = ((quote.price - technicals.sma50) / technicals.sma50 * 100).toFixed(1);
    context += ` (price is ${Number(pctVsSma50) >= 0 ? "+" : ""}${pctVsSma50}% vs SMA50)`;
  }
  context += "\n";
  if (technicals.sma20 !== null && technicals.sma50 !== null) {
    const crossover = technicals.sma20 > technicals.sma50 ? "Golden Cross (bullish)" : "Death Cross (bearish)";
    context += `- SMA Crossover Status: ${crossover}\n`;
  }
  context += `- 20-day EMA: ${technicals.ema20 !== null ? technicals.ema20.toFixed(2) : "N/A"}\n`;
  context += `- RSI (14): ${technicals.rsi !== null ? technicals.rsi.toFixed(2) : "N/A"}`;
  if (technicals.rsi !== null) {
    const rsiLabel = technicals.rsi > 70 ? " (OVERBOUGHT)" : technicals.rsi < 30 ? " (OVERSOLD)" : " (Neutral zone)";
    context += rsiLabel;
  }
  context += "\n";
  context += `- MACD Line: ${technicals.macd.macdLine !== null ? technicals.macd.macdLine.toFixed(2) : "N/A"}\n`;
  context += `- MACD Signal: ${technicals.macd.signalLine !== null ? technicals.macd.signalLine.toFixed(2) : "N/A"}\n`;
  context += `- MACD Histogram: ${technicals.macd.histogram !== null ? technicals.macd.histogram.toFixed(2) : "N/A"}`;
  if (technicals.macd.histogram !== null) {
    context += technicals.macd.histogram > 0 ? " (Bullish momentum)" : " (Bearish momentum)";
  }
  context += "\n";
  context += `- Trend Direction: ${technicals.trend.toUpperCase()}\n`;
  context += `- Support Levels: ${technicals.supportLevels.map((s) => s.toFixed(2)).join(", ") || "N/A"}\n`;
  context += `- Resistance Levels: ${technicals.resistanceLevels.map((r) => r.toFixed(2)).join(", ") || "N/A"}\n`;
  if (technicals.breakoutZones.length > 0) {
    context += `- Breakout Zones:\n`;
    for (const zone of technicals.breakoutZones) {
      context += `  - ${zone.type.toUpperCase()}: ${zone.low.toFixed(2)} - ${zone.high.toFixed(2)}\n`;
    }
  }
  context += "\n";

  // ── News ──
  if (news.length > 0) {
    context += `### Recent News (${news.length} items)\n`;
    for (const item of news.slice(0, 8)) {
      if (item.url) {
        context += `- [${item.title}](${item.url}) — ${item.source} (${item.publishedAt.split("T")[0]})\n`;
      } else {
        context += `- ${item.title} — ${item.source} (${item.publishedAt.split("T")[0]})\n`;
      }
    }
    context += "\n";
  }

  // ── Macro Risks ──
  if (macroRisks.length > 0) {
    context += `### Macro & Geopolitical Risks\n`;
    for (const risk of macroRisks) {
      context += `- ${risk}\n`;
    }
    context += "\n";
  }

  // ── Supply Chain Risks ──
  if (rawMaterialRisks.length > 0) {
    context += `### Supply Chain / Raw Material Risks\n`;
    for (const risk of rawMaterialRisks) {
      context += `- ${risk}\n`;
    }
    context += "\n";
  }

  return context;
}

function formatLargeNumber(value: number): string {
  if (value >= 1e12) return (value / 1e12).toFixed(2) + "T";
  if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
  if (value >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (value >= 1e3) return (value / 1e3).toFixed(2) + "K";
  return value.toString();
}

/**
 * Stream a stock analysis response from Groq.
 */
export async function streamStockAnalysis(
  message: string,
  analysis: StockAnalysis,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ReadableStream<Uint8Array>> {
  const stockContext = buildStockContext(analysis);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: STOCK_ANALYSIS_SYSTEM_PROMPT },
    {
      role: "system",
      content: `Here is the real-time data you should reference in your response:\n\n${stockContext}`,
    },
  ];

  // Add conversation history (last 10 messages for context window management)
  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: message });

  const client = getGroqClient();
  const model = await getWorkingModel(client);
  console.log("[Groq] Starting stock analysis stream with", messages.length, "messages, model:", model);

  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 8192,
      stream: true,
    });

    console.log("[Groq] Stream created successfully");

    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controller) {
        try {
          let chunkCount = 0;
          for await (const chunk of completion) {
            chunkCount++;
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          console.log("[Groq] Stream completed with", chunkCount, "chunks");
          controller.close();
        } catch (error) {
          console.error("[Groq] Stream error:", error);
          controller.error(error);
        }
      },
    });
  } catch (error) {
    console.error("[Groq] Failed to create stream:", error);
    throw error;
  }
}

/**
 * Stream a general financial chat response from Groq.
 */
export async function streamGeneralChat(
  message: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ReadableStream<Uint8Array>> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: GENERAL_CHAT_PROMPT },
  ];

  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: message });

  const client = getGroqClient();
  const model = await getWorkingModel(client);
  console.log("[Groq] Starting general chat stream with", messages.length, "messages, model:", model);

  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 3072,
      stream: true,
    });

    console.log("[Groq] General chat stream created");

    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controller) {
        try {
          let chunkCount = 0;
          for await (const chunk of completion) {
            chunkCount++;
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          console.log("[Groq] General chat stream completed with", chunkCount, "chunks");
          controller.close();
        } catch (error) {
          console.error("[Groq] General chat stream error:", error);
          controller.error(error);
        }
      },
    });
  } catch (error) {
    console.error("[Groq] Failed to create general chat stream:", error);
    throw error;
  }
}

/**
 * Build a comprehensive analysis prompt from StockAnalysis data.
 */
function buildAnalysisPrompt(data: StockAnalysis): string {
  const { quote, history, technicals, news, macroRisks, rawMaterialRisks } = data;

  const historyLength = history.length;
  const oldestDate = historyLength > 0 ? history[0].date : "N/A";
  const newestDate = historyLength > 0 ? history[historyLength - 1].date : "N/A";
  const oldestClose = historyLength > 0 ? history[0].close : 0;
  const newestClose = historyLength > 0 ? history[historyLength - 1].close : 0;

  let cagr = 0;
  if (oldestClose > 0 && historyLength > 252) {
    const years = historyLength / 252;
    cagr = (Math.pow(newestClose / oldestClose, 1 / years) - 1) * 100;
  }

  let datasetHigh = 0;
  let datasetLow = Infinity;
  let athDate = "";
  let atlDate = "";
  for (const h of history) {
    if (h.high > datasetHigh) { datasetHigh = h.high; athDate = h.date; }
    if (h.low < datasetLow && h.low > 0) { datasetLow = h.low; atlDate = h.date; }
  }

  const recent30 = history.slice(-30);
  const recent30Start = recent30.length > 0 ? recent30[0].close : 0;
  const recent30Change = recent30Start > 0
    ? (((newestClose - recent30Start) / recent30Start) * 100).toFixed(2)
    : "0";
  const avgVolume30 = recent30.length > 0
    ? Math.round(recent30.reduce((sum, d) => sum + d.volume, 0) / recent30.length)
    : 0;

  const newsSection = news
    .map((n, i) => {
      if (n.url) {
        return `${i + 1}. [${n.title}](${n.url}) — ${n.source} (${n.publishedAt.split("T")[0]})`;
      }
      return `${i + 1}. ${n.title} — ${n.source} (${n.publishedAt.split("T")[0]})`;
    })
    .join("\n");
  const macroSection = macroRisks.map((r, i) => `${i + 1}. ${r}`).join("\n");
  const rawMatSection = rawMaterialRisks.map((r, i) => `${i + 1}. ${r}`).join("\n");

  const stockContext = buildStockContext(data);

  return `Analyze the following stock and provide a comprehensive investment report:

**STOCK: ${quote.name} (${quote.symbol})**
**Exchange:** ${quote.exchange} | **Currency:** ${quote.currency}

${stockContext}

### Historical Price Data (${oldestDate} to ${newestDate})
- Total trading days: ${historyLength}
- Dataset High: ${quote.currency} ${datasetHigh.toFixed(2)} on ${athDate}
- Dataset Low: ${quote.currency} ${datasetLow === Infinity ? "N/A" : datasetLow.toFixed(2)} on ${atlDate}
- Approximate CAGR: ${cagr.toFixed(2)}%
- Price at start: ${quote.currency} ${oldestClose.toFixed(2)}
- Current price: ${quote.currency} ${newestClose.toFixed(2)}
- Last 30 days change: ${recent30Change}%
- Average daily volume (30d): ${avgVolume30.toLocaleString()}

### Recent News
${newsSection || "No recent news available."}

### Macro & Geopolitical Risk Factors
${macroSection}

### Raw Material & Supply Chain Risk Factors
${rawMatSection}

Please provide your comprehensive analysis now.`;
}

/**
 * Stream a comprehensive stock analysis (standalone, no conversation history).
 * Returns a ReadableStream for use with Next.js streaming responses.
 */
export function streamAnalysis(data: StockAnalysis): ReadableStream<Uint8Array> {
  const userPrompt = buildAnalysisPrompt(data);
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const client = getGroqClient();
        const model = await getWorkingModel(client);
        const stream = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: STOCK_ANALYSIS_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
          top_p: 0.9,
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      } catch (error) {
        console.error("[streamAnalysis] Groq streaming error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `\n\n---\n\n**Analysis Error**: Failed to generate analysis. ${errorMessage}\n\nPlease try again later.`
          )
        );
        controller.close();
      }
    },
  });
}

/**
 * Generate a complete (non-streaming) stock analysis from Groq.
 * Returns the full markdown analysis string.
 */
export async function generateAnalysis(data: StockAnalysis): Promise<string> {
  const userPrompt = buildAnalysisPrompt(data);

  try {
    const client = getGroqClient();
    const model = await getWorkingModel(client);
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: STOCK_ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      top_p: 0.9,
      stream: false,
    });

    return response.choices[0]?.message?.content || "Analysis could not be generated.";
  } catch (error) {
    console.error("[generateAnalysis] Groq error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return `**Analysis Error**: Failed to generate analysis. ${errorMessage}\n\nPlease try again later.`;
  }
}

/**
 * Generate a daily brief summary (non-streaming, returns full text).
 */
export async function generateDailyBrief(prompt: string): Promise<string> {
  const client = getGroqClient();
  const model = await getWorkingModel(client);
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: DAILY_BRIEF_PROMPT,
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.6,
    max_tokens: 1500,
  });

  return completion.choices[0]?.message?.content || "Unable to generate brief.";
}
