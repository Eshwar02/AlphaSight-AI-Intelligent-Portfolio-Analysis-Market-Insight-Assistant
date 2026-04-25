'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { ThumbsUp, ThumbsDown, Share, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './markdown-renderer';
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
    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md">
      <Image src="/logo.svg" alt="AlphaSight" width={18} height={18} />
    </div>
  );
}

function ShareButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-gray-200"
    >
      {copied ? <Check className="h-3 w-3" /> : <Share className="h-3 w-3" />}
      {copied ? 'Copied' : 'Share'}
    </button>
  );
}

function StreamingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300 [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300 [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300 [animation-delay:300ms]" />
    </div>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [feedback, setFeedback] = useState<'good' | 'poor' | null>(null);
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const normalizedContent = useMemo(
    () =>
      message.content
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''),
    [message.content],
  );

  const streamingContent = useMemo(
    () => normalizedContent.replace(/^#+\s*/gm, ''),
    [normalizedContent],
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
  const hasStreamingText = normalizedContent.trim().length > 0;

  if (process.env.NODE_ENV !== 'production' && !isUser) {
    console.debug('[ChatMessage] render', {
      id: message.id,
      isStreaming,
      rawLen: message.content.length,
      visibleLen: visibleText.length,
      rawPreview: message.content.slice(0, 80),
    });
  }

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
              'rounded-2xl rounded-tr-md bg-blue-500 dark:bg-dark-800 px-4 py-2.5',
              'text-[15px] leading-relaxed text-white dark:text-gray-100',
              'border border-gray-200 dark:border-dark-700/60',
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
            {hasStreamingText && (
              <MarkdownRenderer content={normalizedContent} streaming={isStreaming} />
            )}
            {!hasStreamingText && isStreaming && <StreamingDots />}
            {!hasContent && !isStreaming && (
              <div className="text-[15px] leading-7 text-gray-400 italic">
                {EMPTY_RESPONSE_FALLBACK}
              </div>
            )}
            {!hasStreamingText && isStreaming && <StreamingDots />}
            {!hasContent && !isStreaming && (
              <div className="text-[15px] leading-7 text-gray-500 dark:text-gray-400 italic">
                {EMPTY_RESPONSE_FALLBACK}
              </div>
            )}

            {/* Feedback buttons for assistant messages */}
            {!isUser && !isStreaming && hasContent && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setFeedback('good')}
                  className={cn(
                    'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                    feedback === 'good'
                      ? 'bg-accent-brand text-dark-950'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-gray-200'
                  )}
                >
                  <ThumbsUp className="h-3 w-3" />
                  Good
                </button>
                <button
                  onClick={() => setFeedback('poor')}
                  className={cn(
                    'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                    feedback === 'poor'
                      ? 'bg-red-600 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-gray-200'
                  )}
                >
                  <ThumbsDown className="h-3 w-3" />
                  Poor
                </button>
                <ShareButton content={normalizedContent} />
              </div>
            )}

          </div>
        </div>
      )}
    </motion.div>
  );
}
