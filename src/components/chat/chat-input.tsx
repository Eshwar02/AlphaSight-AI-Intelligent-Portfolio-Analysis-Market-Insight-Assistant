'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');

  const hasText = value.trim().length > 0;

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    if (!hasText || isStreaming || disabled) return;
    onSend(value.trim());
    setValue('');
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, hasText, isStreaming, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="border-t border-dark-700/50 bg-dark-900 px-4 pb-4 pt-3">
      <div className="mx-auto max-w-3xl">
        <div
          className={cn(
            'relative flex items-end gap-2 rounded-2xl border bg-dark-800 px-4 py-3',
            'transition-colors duration-200',
            'border-dark-700 focus-within:border-dark-600 focus-within:ring-1 focus-within:ring-dark-600',
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about any stock, market, or portfolio..."
            disabled={disabled}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent text-sm text-gray-200 outline-none',
              'placeholder:text-dark-500',
              'scrollbar-thin scrollbar-thumb-dark-700',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
            style={{ maxHeight: 200 }}
          />

          {/* Send / Stop button */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                'bg-dark-600 text-gray-300 transition-colors hover:bg-dark-500',
              )}
              aria-label="Stop generating"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!hasText || disabled}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
                hasText && !disabled
                  ? 'bg-accent-green text-white hover:bg-accent-green/90'
                  : 'bg-dark-700 text-dark-500 cursor-not-allowed',
              )}
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Model label */}
        <div className="mt-2 text-center">
          <span className="text-[11px] text-dark-500">
            AlphaSight Pro
          </span>
        </div>
      </div>
    </div>
  );
}
