'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './markdown-renderer';
import { StockCard } from './stock-card';
import type { ChatMessage as ChatMessageType } from '@/stores/app-store';

interface ChatMessageProps {
  message: ChatMessageType;
}

function TypingCursor() {
  return (
    <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-gray-400" />
  );
}

function UserAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-green/20">
      <User className="h-3.5 w-3.5 text-accent-green" />
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dark-700">
      <Bot className="h-3.5 w-3.5 text-gray-300" />
    </div>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const hasContent = message.content.length > 0;

  // Parse stock data from metadata if available
  const stockData = useMemo(() => {
    if (!message.stockData) return null;
    return message.stockData;
  }, [message.stockData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="group px-4 py-5"
    >
      <div className="mx-auto flex max-w-3xl gap-4">
        {/* Avatar */}
        <div className="mt-0.5 shrink-0">
          {isUser ? <UserAvatar /> : <AssistantAvatar />}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Role label */}
          <div className="mb-1.5 text-xs font-semibold text-gray-300">
            {isUser ? 'You' : 'AlphaSight'}
          </div>

          {/* Message body */}
          {isUser ? (
            <div className="text-sm leading-7 text-gray-200">
              {message.content}
            </div>
          ) : (
            <div>
              {/* Stock cards rendered above the markdown when present */}
              {stockData && stockData.length > 0 && (
                <div className="mb-3">
                  {stockData.map((stock) => (
                    <StockCard key={stock.symbol} stock={stock} />
                  ))}
                </div>
              )}

              {hasContent ? (
                <MarkdownRenderer content={message.content} />
              ) : isStreaming ? (
                <div className="flex items-center gap-1 py-1">
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-dark-400 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-dark-400 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-dark-400 [animation-delay:300ms]" />
                  </span>
                </div>
              ) : null}

              {/* Blinking cursor during streaming with content */}
              {isStreaming && hasContent && <TypingCursor />}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
