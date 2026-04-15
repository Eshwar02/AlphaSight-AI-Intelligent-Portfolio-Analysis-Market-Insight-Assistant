import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSymbol } from "@/lib/stock/symbols";
import { fetchQuote, fetchHistory, fetchCompanyInfo } from "@/lib/stock/data";
import { analyzeTechnicals } from "@/lib/stock/technicals";
import { fetchStockNews } from "@/lib/stock/news";
import { assessMacroRisks, assessRawMaterialRisks } from "@/lib/stock/macro";
import { streamStockAnalysis, streamGeneralChat, validateGroqSetup, classifyIntent } from "@/lib/ai/groq";
import type { StockAnalysis } from "@/types/stock";

// Regex patterns for detecting stock queries
const TICKER_PATTERN = /\$?([A-Z]{2,10}(?:\.[A-Z]{1,2})?)\b/g;
const STOCK_KEYWORDS =
  /\b(stock|share|price|quote|analysis|analyze|ticker|market cap|pe ratio|buy|sell|hold|bullish|bearish|technical|fundamentals?|earnings|dividend|chart|52.week|support|resistance|rsi|sma|moving average)\b/i;
const COMPANY_NAMES =
  /\b(apple|microsoft|google|alphabet|amazon|tesla|meta|facebook|nvidia|netflix|amd|intel|disney|walmart|jpmorgan|coca.cola|pepsi|boeing|nike|visa|mastercard|paypal|salesforce|adobe|spotify|uber|airbnb|snowflake|palantir|coinbase|shopify|zoom|oracle|ibm|qualcomm|broadcom|berkshire|reliance|tcs|infosys|wipro|hdfc|tata)\b/i;
const MARKET_OVERVIEW_KEYWORDS =
  /\b(markets?|economy|inflation|fed|interest rates?|dow|nasdaq|s&p|sensex|nifty|indices?|global|macro)\b/i;
const COMMON_NON_TICKER_WORDS = new Set([
  "US", "USA", "THE", "AND", "FOR", "ARE", "NOT", "YOU", "ALL",
  "CAN", "HAD", "HER", "WAS", "ONE", "OUR", "OUT", "DAY", "GET",
  "HAS", "HIM", "HIS", "HOW", "ITS", "MAY", "NEW", "NOW", "OLD",
  "SEE", "WAY", "WHO", "DID", "LET", "SAY", "SHE", "TOO", "USE",
  "WHAT", "WHEN", "WILL", "WITH", "THIS", "THAT", "FROM", "HAVE",
  "BEEN", "SOME", "THAN", "THEM", "THEN", "VERY", "JUST", "ABOUT",
  "INTO", "OVER", "ALSO", "BACK", "WELL", "ONLY", "EVEN", "MOST",
  // Financial acronyms that look like tickers but aren't
  "PE", "EPS", "RSI", "SMA", "EMA", "ETF", "IPO", "GDP", "CPI",
  "PMI", "CEO", "CFO", "ROE", "ROI", "NAV", "EMI", "FII", "DII",
  "RBI", "SEC", "FED", "YOY", "QOQ", "ATH", "ATL", "OTC",
]);

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function withStreamTimeout(
  stream: ReadableStream<Uint8Array>,
  timeoutMs: number,
  label: string
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();

      try {
        while (true) {
          const next = await Promise.race<ReadableStreamReadResult<Uint8Array> | null>([
            reader.read(),
            new Promise<null>((resolve) => {
              setTimeout(() => resolve(null), timeoutMs);
            }),
          ]);

          if (next === null) {
            controller.enqueue(
              encoder.encode(
                "\n\nThe model response timed out. Please try again."
              )
            );
            await reader.cancel(`${label} timed out`);
            controller.close();
            return;
          }

          if (next.done) {
            controller.close();
            return;
          }

          controller.enqueue(next.value);
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

/**
 * Detect if a user message is asking about a specific stock.
 * Returns the extracted query for symbol resolution, or null.
 */
function detectStockQuery(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  // Check for company name mentions
  const companyMatch = message.match(COMPANY_NAMES);
  const hasStockKeyword = STOCK_KEYWORDS.test(message);
  const isLikelyMarketOverview = MARKET_OVERVIEW_KEYWORDS.test(message);

  if (companyMatch) {
    return companyMatch[0];
  }

  const tickerCandidates = Array.from(message.matchAll(TICKER_PATTERN))
    .map((m) => (m[1] || "").toUpperCase())
    .filter((word) => word && !COMMON_NON_TICKER_WORDS.has(word));

  const explicitDollarTicker = message.match(/\$([A-Z]{1,10}(?:\.[A-Z]{1,2})?)/);
  if (explicitDollarTicker?.[1]) {
    return explicitDollarTicker[1].toUpperCase();
  }

  if (tickerCandidates.length > 0) {
    const standaloneTicker =
      tickerCandidates.length === 1 &&
      trimmed.replace("$", "").toUpperCase() === tickerCandidates[0];
    if (hasStockKeyword || standaloneTicker) {
      return tickerCandidates[0];
    }
  }

  if (!hasStockKeyword || isLikelyMarketOverview) {
    return null;
  }

  const extractionPatterns = [
    /(?:stock|price|quote|analysis|analyze)\s+(?:of|for|on)\s+([a-zA-Z0-9.&\-\s]{2,40})/i,
    /(?:about)\s+([a-zA-Z0-9.&\-\s]{2,40})\s+(?:stock|share)/i,
    /([a-zA-Z0-9.&\-\s]{2,40})\s+(?:stock|share)\s+(?:price|analysis|quote)/i,
  ];

  for (const pattern of extractionPatterns) {
    const match = trimmed.match(pattern);
    if (!match?.[1]) continue;
    const candidate = match[1].replace(/\s+/g, " ").trim();
    if (candidate.length >= 2) return candidate;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[chat] Auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { message, conversationId } = body as {
      message?: string;
      conversationId?: string;
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (message.length > 4000) {
      return NextResponse.json(
        { error: "Message too long (max 4000 characters)" },
        { status: 400 }
      );
    }

    console.log(`[chat] New message from user ${user.id}: "${message.slice(0, 50)}..."`);

    // Validate Groq setup early
    const groqValidation = validateGroqSetup();
    if (!groqValidation.valid) {
      console.error("[chat] Groq validation failed:", groqValidation.error);
      return NextResponse.json(
        { error: "LLM service not configured", details: groqValidation.error },
        { status: 503 }
      );
    }

    // Resolve or create conversation
    let activeConversationId = conversationId;

    if (!activeConversationId) {
      // Create a new conversation with title derived from first message
      const title =
        message.length > 60 ? message.substring(0, 60) + "..." : message;

      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();

      if (convError || !newConversation) {
        return NextResponse.json(
          { error: "Failed to create conversation" },
          { status: 500 }
        );
      }

      activeConversationId = newConversation.id;
    } else {
      // Verify conversation belongs to user
      const { data: existingConv, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", activeConversationId)
        .eq("user_id", user.id)
        .single();

      if (convError || !existingConv) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }
    }

    // Save user message to DB
    const { error: userMsgError } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      role: "user",
      content: message,
    });

    if (userMsgError) {
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 }
      );
    }

    // Fetch conversation history for context
    const { data: historyRows } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const conversationHistory: Array<{
      role: "user" | "assistant";
      content: string;
    }> = (historyRows || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Detect if this is a stock query — Phase 1: regex, Phase 2: LLM fallback
    let stockQuery = detectStockQuery(message);

    // Phase 2: If regex missed it, use LLM to classify intent
    if (!stockQuery) {
      try {
        const classification = await withTimeout(
          classifyIntent(message),
          3000,
          "intentClassification"
        );
        if (classification?.intent === "stock_query" && classification.company_name) {
          stockQuery = classification.company_name;
          console.log(`[chat] NLP classified as stock query: "${classification.company_name}"`);
        }
      } catch (err) {
        console.warn("[chat] Intent classification failed, proceeding as general chat:", err);
      }
    }

    console.log(`[chat] user=${user.id} stockQuery=${stockQuery} msg="${message.slice(0, 80)}"`);
    let stockAnalysis: StockAnalysis | null = null;
    let stream: ReadableStream<Uint8Array> | null = null;

    try {
      if (stockQuery) {
        // Resolve the symbol
        const symbol = await resolveSymbol(stockQuery);

        if (symbol) {
          try {
            const quote = await withTimeout(fetchQuote(symbol), 8000, "quote");
            if (!quote) throw new Error("Quote not found");

            const [historyResult, companyInfoResult, newsResult] =
              await Promise.allSettled([
                withTimeout(fetchHistory(symbol), 12000, "history"),
                withTimeout(fetchCompanyInfo(symbol), 8000, "companyInfo"),
                withTimeout(fetchStockNews(symbol), 8000, "news"),
              ]);

            const history =
              historyResult.status === "fulfilled" ? historyResult.value : [];
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

            const technicals = analyzeTechnicals(history, quote.price);
            const macroRisks = assessMacroRisks(
              symbol,
              companyInfo.sector,
              companyInfo.country
            );
            const rawMaterialRisks = assessRawMaterialRisks(
              symbol,
              companyInfo.sector
            );

            stockAnalysis = {
              quote,
              history,
              technicals,
              news,
              macroRisks,
              rawMaterialRisks,
              companyInfo,
            };

            stream = await withTimeout(
              streamStockAnalysis(message, stockAnalysis, conversationHistory),
              20000,
              "stockAnalysisStream"
            );
          } catch (err) {
            // If stock data fetch fails, fall back to general chat
            console.error("[chat] Stock data fetch error:", err);
            stream = await withTimeout(
              streamGeneralChat(message, conversationHistory),
              20000,
              "generalChatStreamFallback"
            );
          }
        } else {
          // Symbol not resolved, fall back to general chat
          stream = await withTimeout(
            streamGeneralChat(message, conversationHistory),
            20000,
            "generalChatStreamNoSymbol"
          );
        }
      } else {
        // General financial chat
        stream = await withTimeout(
          streamGeneralChat(message, conversationHistory),
          20000,
          "generalChatStream"
        );
      }
    } catch (err) {
      // Fallback if anything goes wrong
      console.error("[chat] Unexpected error during streaming setup:", err);
      try {
        stream = await withTimeout(
          streamGeneralChat(message, conversationHistory),
          20000,
          "generalChatStreamFallback"
        );
      } catch (fallbackErr) {
        console.error("[chat] Fallback stream also failed:", fallbackErr);
        throw fallbackErr;
      }
    }

    if (!stream) {
      return NextResponse.json(
        { error: "Failed to initialize chat stream" },
        { status: 500 }
      );
    }

    const guardedStream = withStreamTimeout(stream!, 45000, "chatStream");

    // Create a tee to capture the full response for saving to DB
    const [streamForClient, streamForCapture] = guardedStream.tee();

    // Save the AI response asynchronously after streaming completes
    const saveResponsePromise = (async () => {
      const reader = streamForCapture.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }

      if (fullResponse.trim().length > 0) {
        // Build metadata including stock data for inline cards
        const metadata: Record<string, unknown> = {};
        if (stockAnalysis) {
          metadata.stockData = [
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
          ];
          metadata.technicals = {
            sma20: stockAnalysis.technicals.sma20,
            sma50: stockAnalysis.technicals.sma50,
            rsi: stockAnalysis.technicals.rsi,
            trend: stockAnalysis.technicals.trend,
            supportLevels: stockAnalysis.technicals.supportLevels,
            resistanceLevels: stockAnalysis.technicals.resistanceLevels,
          };
          metadata.news = stockAnalysis.news.map((n) => ({
            title: n.title,
            url: n.url,
            source: n.source,
            publishedAt: n.publishedAt,
          }));
        }

        await supabase.from("messages").insert({
          conversation_id: activeConversationId!,
          role: "assistant",
          content: fullResponse,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
        });

        // Update conversation timestamp
        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", activeConversationId!);
      }
    })();

    // Don't await the save -- let it run in the background
    // Use waitUntil pattern if available, otherwise just fire-and-forget
    saveResponsePromise.catch((err) => {
      console.error("Failed to save AI response:", err);
    });

    // Return streaming response with conversation metadata in headers
    const responseHeaders: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Conversation-Id": activeConversationId!,
      "X-Has-Stock-Data": stockAnalysis ? "true" : "false",
      "Access-Control-Expose-Headers":
        "X-Conversation-Id, X-Has-Stock-Data, X-Stock-Quote",
    };

    if (stockAnalysis) {
      responseHeaders["X-Stock-Quote"] = encodeURIComponent(
        JSON.stringify(stockAnalysis.quote)
      );
    }

    return new Response(streamForClient, {
      headers: {
        ...responseHeaders,
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error details:", errorMessage);
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
