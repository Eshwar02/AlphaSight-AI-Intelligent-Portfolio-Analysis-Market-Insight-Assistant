import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamChat, validateAiSetup } from "@/lib/ai";
import { resolveSymbol } from "@/lib/stock/symbols";
import { fetchQuote, fetchHistory, fetchCompanyInfo } from "@/lib/stock/data";
import { fetchStockNews } from "@/lib/stock/news";
import { analyzeTechnicals } from "@/lib/stock/technicals";
import { assessMacroRisks, assessRawMaterialRisks } from "@/lib/stock/macro";
import type { StockAnalysis } from "@/types/stock";

const EMPTY_RESPONSE_FALLBACK =
  "Unable to generate analysis right now. Showing available data below.";

const TICKER_PATTERN = /\$([A-Z]{1,10}(?:\.[A-Z]{1,2})?)\b/;
const STOCK_KEYWORDS =
  /\b(stock|share|price|quote|analysis|analyze|ticker|buy|sell|hold|chart|support|resistance|rsi|sma)\b/i;

function detectStockQuery(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const dollarMatch = trimmed.match(TICKER_PATTERN);
  if (dollarMatch?.[1]) return dollarMatch[1].toUpperCase();

  if (/^[A-Z]{1,10}(\.[A-Z]{1,2})?$/.test(trimmed)) return trimmed.toUpperCase();

  if (!STOCK_KEYWORDS.test(trimmed)) return null;

  const nounPhraseMatch = trimmed.match(
    /(?:stock|price|analysis|quote)\s+(?:for|of|on)\s+([a-zA-Z0-9.&\-\s]{2,40})/i
  );
  if (nounPhraseMatch?.[1]) return nounPhraseMatch[1].trim();

  return trimmed;
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { message?: string; conversationId?: string };
    const incomingMessage = body.message?.trim() ?? "";
    const requestedConversationId = body.conversationId ?? null;

    if (!incomingMessage) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (incomingMessage.length > 4000) {
      return NextResponse.json(
        { error: "Message too long (max 4000 characters)" },
        { status: 400 }
      );
    }

    const aiValidation = validateAiSetup();
    if (!aiValidation.valid) {
      return NextResponse.json(
        { error: "LLM service not configured", details: aiValidation.error },
        { status: 503 }
      );
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
        return NextResponse.json(
          { error: "Failed to create conversation", details: error?.message ?? "" },
          { status: 500 }
        );
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
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
    }

    const { error: userMessageError } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      role: "user",
      content: incomingMessage,
    });
    if (userMessageError) {
      return NextResponse.json(
        { error: "Failed to save message", details: userMessageError.message },
        { status: 500 }
      );
    }

    const { data: historyRows } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: true })
      .limit(20);

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

    const stockQuery = detectStockQuery(incomingMessage);
    if (stockQuery) {
      const resolvedSymbol = await withTimeout(resolveSymbol(stockQuery), 7000, "resolveSymbol");
      if (resolvedSymbol) {
        try {
          const quote = await withTimeout(fetchQuote(resolvedSymbol), 9000, "fetchQuote");
          if (!quote) throw new Error("Quote not found");

          const [historyResult, companyInfoResult, newsResult] = await Promise.allSettled([
            withTimeout(fetchHistory(resolvedSymbol), 12000, "fetchHistory"),
            withTimeout(fetchCompanyInfo(resolvedSymbol), 9000, "fetchCompanyInfo"),
            withTimeout(fetchStockNews(resolvedSymbol), 9000, "fetchStockNews"),
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

          stockAnalysis = {
            quote,
            history,
            technicals: analyzeTechnicals(history, quote.price),
            news,
            macroRisks: assessMacroRisks(resolvedSymbol, companyInfo.sector, companyInfo.country),
            rawMaterialRisks: assessRawMaterialRisks(resolvedSymbol, companyInfo.sector),
            companyInfo,
          };
          chatMode = "stock";
        } catch (stockError) {
          llmMessage = `${incomingMessage}\n\nNote: Live stock lookup for "${resolvedSymbol}" failed (${stockError instanceof Error ? stockError.message : String(stockError)}). Explain this briefly, then continue with a useful text-only analysis.`;
        }
      }
    }

    const conversationId = activeConversationId as string;

    let llmStream: ReadableStream<Uint8Array>;
    try {
      llmStream = await withTimeout(
        streamChat({
          mode: chatMode,
          message: llmMessage,
          history: conversationHistory,
          analysis: stockAnalysis ?? undefined,
        }),
        25_000,
        "streamChat"
      );
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

    const timedStream = withStreamTimeout(llmStream, 45_000);
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const chunks: string[] = [];
    let persisted = false;

    const persistAssistantMessage = async () => {
      if (persisted) return;
      persisted = true;

      let fullResponse = chunks.join("");
      if (fullResponse.trim().length === 0) {
        fullResponse = EMPTY_RESPONSE_FALLBACK;
      }

      const metadata = buildStockMetadata(stockAnalysis);

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: fullResponse,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      });

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    };

    const outboundStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = timedStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            const text = decoder.decode(value, { stream: true });
            if (text) chunks.push(text);
            controller.enqueue(value);
          }
        } catch {
          // Stream failure falls back below.
        } finally {
          reader.releaseLock();
          if (chunks.join("").trim().length === 0) {
            chunks.push(EMPTY_RESPONSE_FALLBACK);
            controller.enqueue(encoder.encode(EMPTY_RESPONSE_FALLBACK));
          }
          controller.close();
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
    return NextResponse.json(
      { error: "Internal error", details },
      { status: 500 }
    );
  }
}
