import Groq from "groq-sdk";
import { STOCK_ANALYSIS_SYSTEM_PROMPT, DAILY_BRIEF_PROMPT } from "./prompts";
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

function getGroqClient(): Groq {
  if (groqClient) return groqClient;

  const apiKey = normalizeApiKey(process.env.GROQ_API_KEY);
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  groqClient = new Groq({ apiKey });
  return groqClient;
}

const MODEL = "llama-3.3-70b-versatile";

/**
 * Build a context string from a StockAnalysis object for the LLM.
 */
function buildStockContext(analysis: StockAnalysis): string {
  const { quote, technicals, news, macroRisks, rawMaterialRisks } = analysis;

  let context = `## Stock Data for ${quote.name} (${quote.symbol})\n\n`;

  context += `### Price & Market Data\n`;
  context += `- Current Price: ${quote.currency} ${quote.price.toFixed(2)}\n`;
  context += `- Change: ${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)\n`;
  context += `- Day Range: ${quote.dayLow.toFixed(2)} - ${quote.dayHigh.toFixed(2)}\n`;
  context += `- 52-Week Range: ${quote.low52.toFixed(2)} - ${quote.high52.toFixed(2)}\n`;
  context += `- Market Cap: ${formatLargeNumber(quote.marketCap)}\n`;
  context += `- Volume: ${formatLargeNumber(quote.volume)}\n`;
  context += `- P/E Ratio: ${quote.pe !== null ? quote.pe.toFixed(2) : "N/A"}\n\n`;

  context += `### Technical Indicators\n`;
  context += `- 20-day SMA: ${technicals.sma20 !== null ? technicals.sma20.toFixed(2) : "N/A"}\n`;
  context += `- 50-day SMA: ${technicals.sma50 !== null ? technicals.sma50.toFixed(2) : "N/A"}\n`;
  context += `- 20-day EMA: ${technicals.ema20 !== null ? technicals.ema20.toFixed(2) : "N/A"}\n`;
  context += `- RSI (14): ${technicals.rsi !== null ? technicals.rsi.toFixed(2) : "N/A"}\n`;
  context += `- MACD Line: ${technicals.macd.macdLine !== null ? technicals.macd.macdLine.toFixed(2) : "N/A"}\n`;
  context += `- MACD Signal: ${technicals.macd.signalLine !== null ? technicals.macd.signalLine.toFixed(2) : "N/A"}\n`;
  context += `- MACD Histogram: ${technicals.macd.histogram !== null ? technicals.macd.histogram.toFixed(2) : "N/A"}\n`;
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

  if (news.length > 0) {
    context += `### Recent News\n`;
    for (const item of news.slice(0, 4)) {
      context += `- ${item.title} (${item.source})\n`;
    }
    context += "\n";
  }

  if (macroRisks.length > 0) {
    context += `### Macro Risks\n`;
    for (const risk of macroRisks) {
      context += `- ${risk}\n`;
    }
    context += "\n";
  }

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

  const completion = await getGroqClient().chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
    stream: true,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Stream a general financial chat response from Groq.
 */
export async function streamGeneralChat(
  message: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ReadableStream<Uint8Array>> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: STOCK_ANALYSIS_SYSTEM_PROMPT },
  ];

  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: message });

  const completion = await getGroqClient().chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
    stream: true,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
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
    .map((n, i) => `${i + 1}. [${n.source}] ${n.title} (${n.publishedAt.split("T")[0]})`)
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
        const stream = await getGroqClient().chat.completions.create({
          model: MODEL,
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
    const response = await getGroqClient().chat.completions.create({
      model: MODEL,
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
  const completion = await getGroqClient().chat.completions.create({
    model: MODEL,
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
