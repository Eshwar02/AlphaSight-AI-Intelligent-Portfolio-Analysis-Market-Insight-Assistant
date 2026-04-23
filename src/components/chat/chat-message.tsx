'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './markdown-renderer';
import { MarkdownErrorBoundary } from './markdown-error-boundary';
import { StockCard } from './stock-card';
import { ChartWidget } from './chart-widget';
import type { ChatMessage as ChatMessageType } from '@/stores/app-store';

interface ChatMessageProps {
  message: ChatMessageType;
}

const EMPTY_RESPONSE_FALLBACK =
  'Unable to generate analysis right now. Showing available data below.';

/**
 * Assistant "avatar" — a simple sparkle mark in the brand teal. Replaces the
 * Bot-in-a-circle so the layout reads as plain text (Claude-style) rather
 * than a chat bubble with an icon chip.
 */
function AssistantMark() {
  return (
    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-[18px] w-[18px] text-accent-brand"
        aria-hidden="true"
      >
        <path
          d="M12 2.5 13.6 9.2 20.3 10.8 13.6 12.4 12 19.1 10.4 12.4 3.7 10.8 10.4 9.2 12 2.5Z"
          fill="currentColor"
          fillOpacity="0.9"
        />
        <path
          d="M18.5 3.2 19.1 5.5 21.4 6.1 19.1 6.7 18.5 9 17.9 6.7 15.6 6.1 17.9 5.5 18.5 3.2Z"
          fill="currentColor"
          fillOpacity="0.6"
        />
      </svg>
    </div>
  );
}

function StreamingDots() {
  return (
    <div className="flex items-center gap-1 py-2">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-brand [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-brand [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-brand [animation-delay:300ms]" />
    </div>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const normalizedContent = useMemo(
    () =>
      message.content
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''),
    [message.content],
  );

  // Count text that would actually render visibly. During streaming, the LLM
  // often opens with `---` separators or pure whitespace that markdown renders
  // as an invisible <hr/> — which made the bubble look "stuck" with just a
  // cursor. Treat content as visible only once we have real characters.
  const visibleText = useMemo(
    () =>
      normalizedContent
        .replace(/^(?:\s|-{3,}|\*{3,}|_{3,})+/m, '')
        .trim(),
    [normalizedContent],
  );
  const hasContent = visibleText.length > 0;

  const stockData = useMemo(() => {
    if (!message.stockData) return null;
    return message.stockData;
  }, [message.stockData]);
  const newsData = useMemo(() => {
    if (!message.newsData || message.newsData.length === 0) return null;
    return message.newsData;
  }, [message.newsData]);
  const primarySymbol = stockData?.[0]?.symbol;

  const showEnhancements = hasContent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'px-4 sm:px-6',
        isUser ? 'py-2' : 'py-4',
      )}
    >
      {isUser ? (
        /* ── User: right-aligned rounded pill ───────────────────────── */
        <div className="mx-auto flex max-w-3xl justify-end">
          <div
            className={cn(
              'max-w-[85%] whitespace-pre-wrap break-words',
              'rounded-2xl rounded-tr-md bg-dark-800 px-4 py-2.5',
              'text-[15px] leading-relaxed text-gray-100',
              'border border-dark-700/60',
              'shadow-[0_1px_0_rgba(0,0,0,0.2)]',
            )}
          >
            {message.content}
          </div>
        </div>
      ) : (
        /* ── Assistant: plain text, no bubble, sparkle mark on the left ── */
        <div className="mx-auto flex max-w-3xl gap-3">
          <AssistantMark />
          <div className="min-w-0 flex-1">
            {/* Body */}
            {hasContent ? (
              <div className="text-[15px] leading-7 text-gray-200">
                <MarkdownErrorBoundary content={normalizedContent}>
                  <MarkdownRenderer
                    content={normalizedContent}
                    streaming={isStreaming}
                  />
                </MarkdownErrorBoundary>
              </div>
            ) : isStreaming ? (
              <StreamingDots />
            ) : (
              <div className="text-[15px] leading-7 text-gray-200">
                {EMPTY_RESPONSE_FALLBACK}
              </div>
            )}

            {/* Stock card and chart are optional enhancements after text */}
            {showEnhancements && stockData && stockData.length > 0 && (
              <div className="mt-4">
                {stockData.map((stock) =>
                  typeof stock.price === 'number' ? (
                    <StockCard key={stock.symbol} stock={stock} />
                  ) : null,
                )}
              </div>
            )}

            {showEnhancements && primarySymbol && (
              <div className="mt-4 overflow-hidden rounded-xl border border-dark-700/60">
                <ChartWidget
                  symbol={primarySymbol}
                  exchange={stockData?.[0]?.exchange}
                  height={320}
                />
              </div>
            )}

            {showEnhancements && newsData && (
              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-dark-400">
                  Related News
                </h4>
                <div className="space-y-2">
                  {newsData.slice(0, 5).map((item) => (
                    <a
                      key={`${item.url}-${item.publishedAt}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-dark-700/60 bg-dark-900/30 px-3 py-2 transition-colors hover:border-dark-600"
                    >
                      <p className="text-sm text-gray-200">{item.title}</p>
                      <p className="mt-1 text-xs text-dark-400">
                        {item.source} · {new Date(item.publishedAt).toLocaleDateString()}
                      </p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
