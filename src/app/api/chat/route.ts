import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyIntent, streamChat, validateAiSetup } from "@/lib/ai";
import { searchWeb, validateSerpApiSetup } from "@/lib/ai/web-search";
import { buildUserContext } from "@/lib/ai/user-context";
import { resolveSymbol } from "@/lib/stock/symbols";
import { fetchQuote, fetchHistory, fetchCompanyInfo } from "@/lib/stock/data";
import { fetchStockNews } from "@/lib/stock/news";
import { analyzeTechnicals } from "@/lib/stock/technicals";
import { assessMacroRisks, assessRawMaterialRisks } from "@/lib/stock/macro";
import type { StockAnalysis } from "@/types/stock";

const EMPTY_RESPONSE_FALLBACK =
  "Unable to generate analysis right now. Showing available data below.";

const TICKER_PATTERN = /\$([A-Z]{1,10}(?:\.[A-Z]{1,2})?)\b/;
const NOUN_PHRASE_PATTERN =
  /(?:analyze|analysis\s+of|price\s+of|quote\s+for|stock\s+of)\s+([a-zA-Z0-9.&\-\s]{2,40})/i;

// Regex-only stock detection. Returns a high-confidence match (dollar ticker,
// bare all-caps ticker, or explicit "analyze X" noun phrase) or null.
// Keyword-only matches ("hold on", "what is rsi") used to trigger stock mode
// here — they're now deferred to the LLM classifier to avoid false positives.
function detectStockQuery(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const dollarMatch = trimmed.match(TICKER_PATTERN);
  if (dollarMatch?.[1]) return dollarMatch[1].toUpperCase();

  if (/^[A-Z]{1,10}(\.[A-Z]{1,2})?$/.test(trimmed)) return trimmed.toUpperCase();

  const nounPhraseMatch = trimmed.match(NOUN_PHRASE_PATTERN);
  if (nounPhraseMatch?.[1]) return nounPhraseMatch[1].trim();

  return null;
}

function isGreeting(message: string): boolean {
  const t = message.trim().toLowerCase().replace(/[!.?]+$/g, "");
  if (t.length <= 20 && /^(hi|hey|hello|yo|sup|howdy|good\s+(morning|afternoon|evening|night)|thanks|thank\s+you|ok|okay|bye)$/.test(t)) {
    return true;
  }
  return false;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function withStreamTimeout(
  stream: ReadableStream<Uint8Array>,
  timeoutMs: number
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();
      try {
        while (true) {
          const result = await Promise.race<
            ReadableStreamReadResult<Uint8Array> | { timeout: true }
          >([
            reader.read(),
            new Promise<{ timeout: true }>((resolve) =>
              setTimeout(() => resolve({ timeout: true }), timeoutMs)
            ),
          ]);

          if ("timeout" in result) {
            controller.enqueue(encoder.encode(EMPTY_RESPONSE_FALLBACK));
            await reader.cancel("stream timed out");
            controller.close();
            return;
          }

          if (result.done) {
            controller.close();
            return;
          }

          if (result.value) controller.enqueue(result.value);
        }
      } finally {
        reader.releaseLock();
      }
    },
  });
}

function buildStockMetadata(stockAnalysis: StockAnalysis | null): Record<string, unknown> {
  if (!stockAnalysis) return {};
  return {
    stockData: [
      {
        symbol: stockAnalysis.quote.symbol,
        name: stockAnalysis.quote.name,
        price: stockAnalysis.quote.price,
        change: stockAnalysis.quote.change,
        changePercent: stockAnalysis.quote.changePercent,
        volume: stockAnalysis.quote.volume,
        marketCap: stockAnalysis.quote.marketCap,
        pe: stockAnalysis.quote.pe,
        high52: stockAnalysis.quote.high52,
        low52: stockAnalysis.quote.low52,
        dayHigh: stockAnalysis.quote.dayHigh,
        dayLow: stockAnalysis.quote.dayLow,
        open: stockAnalysis.quote.open,
        previousClose: stockAnalysis.quote.previousClose,
        currency: stockAnalysis.quote.currency,
        exchange: stockAnalysis.quote.exchange,
      },
    ],
    news: stockAnalysis.news.map((n) => ({
      title: n.title,
      url: n.url,
      source: n.source,
      publishedAt: n.publishedAt,
      summary: n.summary,
    })),
  };
}

function compactStockAnalysis(input: StockAnalysis): StockAnalysis {
  const compactCompanyInfo = input.companyInfo
    ? {
        ...input.companyInfo,
        description: input.companyInfo.description
          ? input.companyInfo.description.slice(0, 400)
          : "",
      }
    : undefined;

  return {
    ...input,
    // Keep roughly one trading year to reduce context size and token usage.
    history: input.history.slice(-260),
    news: input.news.slice(0, 4),
    macroRisks: input.macroRisks.slice(0, 4),
    rawMaterialRisks: input.rawMaterialRisks.slice(0, 4),
    companyInfo: compactCompanyInfo,
  };
}

function hasVisibleText(value: string): boolean {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim().length > 0;
}

function chatJsonResponse(
  text: string,
  status: number,
  opts?: { error?: string; details?: string; meta?: Record<string, unknown> }
) {
  return NextResponse.json(
    {
      text: hasVisibleText(text) ? text : EMPTY_RESPONSE_FALLBACK,
      charts: [],
      meta: opts?.meta ?? {},
      ...(opts?.error ? { error: opts.error } : {}),
      ...(opts?.details ? { details: opts.details } : {}),
    },
    { status }
  );
}

export async function POST(request: NextRequest) {
  try {
    console.debug("[chat-api] request received");
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return chatJsonResponse("Your session expired. Please log in again.", 401, {
        error: "Unauthorized",
      });
    }

    const body = (await request.json()) as {
      message?: string;
      conversationId?: string;
      model?: "mistral";
    };
    const incomingMessage = body.message?.trim() ?? "";
    const requestedConversationId = body.conversationId ?? null;
    const requestedModel: "mistral" = "mistral";

    if (!incomingMessage) {
      return chatJsonResponse("Please enter a message.", 400, {
        error: "Message is required",
      });
    }

    if (incomingMessage.length > 4000) {
      return chatJsonResponse("Message too long. Please shorten and retry.", 400, {
        error: "Message too long (max 4000 characters)",
      });
    }
    console.debug("[chat-api] validated request", {
      userId: user.id,
      messageLength: incomingMessage.length,
      hasConversationId: Boolean(requestedConversationId),
    });

    const aiValidation = validateAiSetup();
    if (!aiValidation.valid) {
      return chatJsonResponse(EMPTY_RESPONSE_FALLBACK, 503, {
        error: "LLM service not configured",
        details: aiValidation.error,
      });
    }

    let activeConversationId = requestedConversationId;
    if (!activeConversationId) {
      const title =
        incomingMessage.length > 60
          ? `${incomingMessage.substring(0, 60)}...`
          : incomingMessage;
      const { data: conversation, error } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();
      if (error || !conversation) {
        return chatJsonResponse(EMPTY_RESPONSE_FALLBACK, 500, {
          error: "Failed to create conversation",
          details: error?.message ?? "",
        });
      }
      activeConversationId = conversation.id;
    } else {
      const { data: existing, error } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", activeConversationId)
        .eq("user_id", user.id)
        .single();
      if (error || !existing) {
        return chatJsonResponse("Conversation not found.", 404, {
          error: "Conversation not found",
        });
      }
    }

    const { error: userMessageError } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      role: "user",
      content: incomingMessage,
    });
    if (userMessageError) {
      return chatJsonResponse(EMPTY_RESPONSE_FALLBACK, 500, {
        error: "Failed to save message",
        details: userMessageError.message,
      });
    }

    // Detect and save user memory (e.g., name)
    const nameMatch = incomingMessage.match(/(?:my name is|I am|I'm|call me)\s+([a-zA-Z\s]+)/i);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      console.log("[chat-api] Saving name:", name);
      const { error } = await supabase
        .from("user_memory")
        .upsert({ user_id: user.id, key: "name", value: name }, { onConflict: "user_id,key" });
      if (error) console.error("[chat-api] Save name error:", error);
    }

    const [historyResponse, userMemoryBase] = await Promise.all([
      supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true })
        .limit(6),
      buildUserContext(supabase, user.id).catch((err) => {
        console.warn("[chat-api] buildUserContext failed", err);
        return "";
      }),
    ]);

    let userMemory = userMemoryBase;

    const historyRows = historyResponse.data;
    const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = (
      historyRows || []
    )
      .filter((m): m is { role: "user" | "assistant"; content: string } =>
        m.role === "user" || m.role === "assistant"
      )
      .map((m) => ({ role: m.role, content: m.content ?? "" }));

    let stockAnalysis: StockAnalysis | null = null;
    let llmMessage = incomingMessage;
    let chatMode: "stock" | "general" = "general";
    let generalKind: "brief" | "normal" = "normal";

    // Intent pipeline:
    // 1. Regex (high-confidence stock signals) → stock mode candidate
    // 2. Classifier LLM fallback → stock / greeting / general
    let stockQuery: string | null = detectStockQuery(incomingMessage);
    console.debug("[chat-api] regex detection", { stockQuery: stockQuery ?? null });

    // Skip classifier for short lowercase general questions — saves quota.
    const looksLikeGeneral =
      incomingMessage.length < 60 &&
      !/[A-Z]{2,}/.test(incomingMessage) &&
      !/\b(stock|share|ticker|price|quote|analyze|analysis|chart|buy|sell)\b/i.test(
        incomingMessage
      );

    if (!stockQuery) {
      if (isGreeting(incomingMessage)) {
        generalKind = "brief";
        console.debug("[chat-api] greeting shortcut");
      } else if (looksLikeGeneral) {
        console.debug("[chat-api] general shortcut (skip classifier)");
      } else {
        try {
          const intent = await withTimeout(
            classifyIntent(incomingMessage),
            3000,
            "classifyIntent"
          );
          console.debug("[chat-api] classifier result", intent ?? null);
          if (intent) {
            if (intent.intent === "stock_query" || intent.intent === "comparison") {
              stockQuery =
                intent.company_name ||
                (intent.symbols && intent.symbols[0]) ||
                incomingMessage;
            } else if (intent.intent === "greeting") {
              generalKind = "brief";
            }
          }
        } catch (error) {
          console.warn("[chat-api] classifier failed", error instanceof Error ? error.message : error);
        }
      }
    }

    if (stockQuery) {
      const resolvedSymbol = await withTimeout(resolveSymbol(stockQuery), 8000, "resolveSymbol");
      console.debug("[chat-api] symbol resolution", {
        query: stockQuery,
        symbol: resolvedSymbol ?? null,
      });
      if (!resolvedSymbol) {
        // Classifier or regex thought this was a stock, but we couldn't
        // resolve a ticker. Answer in general mode with a short note instead
        // of forcing the 8-section stock prompt.
        llmMessage = `${incomingMessage}\n\n(Context note for the assistant: I tried to look up live market data for "${stockQuery}" but no matching ticker was found. Answer the user's question helpfully without pretending to have real-time prices.)`;
      }
      if (resolvedSymbol) {
        try {
          const quote = await withTimeout(fetchQuote(resolvedSymbol), 10000, "fetchQuote");
          if (!quote) throw new Error("Quote not found");

          // Detect if this is a simple query (price, quote, etc.) to skip heavy data fetching
          const isSimpleQuery = /\b(price|quote|current|worth|cost|value|trading\s+at)\b/i.test(incomingMessage) &&
                                !/\b(analyze|analysis|technical|fundamental|news|sentiment|recommend|buy|sell|invest)\b/i.test(incomingMessage);

          if (isSimpleQuery) {
            console.debug("[chat-api] simple stock query detected, skipping heavy data");
            // For simple queries, just get quote and minimal data
            stockAnalysis = compactStockAnalysis({
              quote,
              history: [], // Skip history for simple queries
              technicals: {
                sma20: null,
                sma50: null,
                ema20: null,
                rsi: null,
                macd: { macdLine: null, signalLine: null, histogram: null },
                supportLevels: [],
                resistanceLevels: [],
                breakoutZones: [],
                trend: "neutral"
              },
              news: [], // Skip news for simple queries
              macroRisks: [],
              rawMaterialRisks: [],
              companyInfo: {
                sector: "Unknown",
                industry: "Unknown",
                description: "",
                employees: null,
                website: "",
                country: "",
              },
            });
            chatMode = "stock";
            console.debug("[chat-api] simple stock analysis ready", { symbol: resolvedSymbol });
          } else {
            // Full analysis for complex queries
          const [historyResult, companyInfoResult, newsResult] = await Promise.allSettled([
            withTimeout(fetchHistory(resolvedSymbol, 1), 10000, "fetchHistory"), // Faster timeout
            withTimeout(fetchCompanyInfo(resolvedSymbol), 10000, "fetchCompanyInfo"), // Faster timeout
            withTimeout(fetchStockNews(resolvedSymbol), 10000, "fetchStockNews"), // Faster timeout
          ]);

            const history = historyResult.status === "fulfilled" ? historyResult.value : [];
            const companyInfo =
              companyInfoResult.status === "fulfilled"
                ? companyInfoResult.value
                : {
                    sector: "Unknown",
                    industry: "Unknown",
                    description: "",
                    employees: null,
                    website: "",
                    country: "",
                  };
            const news = newsResult.status === "fulfilled" ? newsResult.value : [];

            stockAnalysis = compactStockAnalysis({
              quote,
              history,
              technicals: analyzeTechnicals(history, quote.price),
              news,
              macroRisks: assessMacroRisks(resolvedSymbol, companyInfo.sector, companyInfo.country),
              rawMaterialRisks: assessRawMaterialRisks(resolvedSymbol, companyInfo.sector),
              companyInfo,
            });
            chatMode = "stock";
            console.debug("[chat-api] full stock analysis ready", {
              symbol: resolvedSymbol,
              historyPoints: history.length,
              newsCount: news.length,
            });
          }
        } catch (stockError) {
          console.error("[chat-api] stock enrichment failed", stockError);
          llmMessage = `${incomingMessage}\n\nNote: Live stock lookup for "${resolvedSymbol}" failed (${stockError instanceof Error ? stockError.message : String(stockError)}). Explain this briefly, then continue with a useful text-only analysis.`;
        }
      }
    }

    // Web search for general queries that need current info
    let webSearchResults = "";
    if (chatMode === "general" && validateSerpApiSetup().valid) {
      const searchKeywords = /\b(current|latest|news|search|find|what is|who is|how to|update|recent|today|now)\b/i;
      if (searchKeywords.test(incomingMessage)) {
        try {
          webSearchResults = await searchWeb(incomingMessage, 3);
        } catch (error) {
          console.warn("[chat-api] Web search failed:", error);
          webSearchResults = "";
        }
      }
    }

    userMemory += webSearchResults ? `\n\nWeb Search Results:\n${webSearchResults}` : "";

    const conversationId = activeConversationId as string;

    let llmStream: ReadableStream<Uint8Array>;
    let usedProvider = "unknown";
    try {
      console.debug("[chat-api] opening LLM stream", { mode: chatMode });
      const result = await withTimeout(
        streamChat({
          mode: chatMode,
          message: llmMessage,
          history: conversationHistory,
          analysis: stockAnalysis ?? undefined,
          kind: generalKind,
          model: requestedModel,
          userMemory: userMemory || undefined,
        }),
        90_000,
        "streamChat"
      );
      llmStream = result.stream;
      usedProvider = result.provider;
    } catch (llmError) {
      console.error("CHAT ERROR:", llmError);
      const encoder = new TextEncoder();
      llmStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(EMPTY_RESPONSE_FALLBACK));
          controller.close();
        },
      });
    }

    const timedStream = withStreamTimeout(llmStream, 60_000);
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const chunks: string[] = [];
    let persisted = false;

    const persistAssistantMessage = async () => {
      if (persisted) return;
      persisted = true;

      let fullResponse = chunks.join("");
      if (!hasVisibleText(fullResponse)) {
        fullResponse = EMPTY_RESPONSE_FALLBACK;
      }
      console.debug("[chat-api] persisting assistant response", {
        conversationId,
        chars: fullResponse.length,
        visible: hasVisibleText(fullResponse),
      });

      const metadata = buildStockMetadata(stockAnalysis);
      if (Object.keys(metadata).length > 0) {
        metadata.provider = usedProvider;
      } else {
        metadata.provider = usedProvider;
      }

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: fullResponse,
        metadata: metadata,
      });

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    };

    const outboundStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = timedStream.getReader();
        let chunkCount = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            const text = decoder.decode(value, { stream: true });
            if (text) {
              chunks.push(text);
              chunkCount++;
            }
            controller.enqueue(value);
          }
        } catch {
          // Stream failure falls back below.
        } finally {
          reader.releaseLock();
          if (!hasVisibleText(chunks.join(""))) {
            chunks.push(EMPTY_RESPONSE_FALLBACK);
            controller.enqueue(encoder.encode(EMPTY_RESPONSE_FALLBACK));
          }
          controller.close();
          console.debug("[chat-api] stream finished", {
            conversationId,
            chunks: chunkCount,
            totalChars: chunks.join("").length,
          });
          persistAssistantMessage().catch((error) =>
            console.error("CHAT ERROR:", error)
          );
        }
      },
      cancel() {
        persistAssistantMessage().catch((error) => console.error("CHAT ERROR:", error));
      },
    });

    const responseHeaders: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Conversation-Id": conversationId,
      "X-Has-Stock-Data": stockAnalysis ? "true" : "false",
      "Access-Control-Expose-Headers":
        "X-Conversation-Id, X-Has-Stock-Data, X-Stock-Symbol, X-Stock-Exchange",
    };
    if (stockAnalysis) {
      responseHeaders["X-Stock-Symbol"] = stockAnalysis.quote.symbol;
      responseHeaders["X-Stock-Exchange"] = stockAnalysis.quote.exchange || "";
    }

    return new Response(outboundStream, { headers: responseHeaders });
  } catch (error) {
    console.error("CHAT ERROR:", error);
    const details = error instanceof Error ? error.message : String(error);
    return chatJsonResponse(EMPTY_RESPONSE_FALLBACK, 500, {
      error: "Internal error",
      details,
    });
  }
}
