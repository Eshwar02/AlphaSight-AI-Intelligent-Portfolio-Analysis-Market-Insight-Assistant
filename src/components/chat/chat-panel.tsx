'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useChat } from '@/lib/hooks/use-chat';
import { ChatMessage } from './chat-message';
import { WelcomeScreen } from './welcome-screen';
import { GradientAIChatInput, type ModelOption } from '@/components/ui/gradient-ai-chat-input';
import { cn } from '@/lib/utils';
import { BookOpen } from 'lucide-react';

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'mistral',
    label: 'Mistral',
    value: 'mistral',
    description: 'Primary — large free tier',
  },
];

function LoadingSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl animate-pulse flex-col gap-6 px-4 py-8 sm:px-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="h-6 w-6 shrink-0 rounded bg-dark-800" />
          <div className="flex-1 space-y-2.5">
            <div className="h-3 w-full rounded bg-dark-800/70" />
            <div className="h-3 w-3/4 rounded bg-dark-800/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatPanel() {
  const { messages, isLoadingConversation, isStreaming, preferredModel, setPreferredModel } =
    useAppStore();
  const { sendMessage, stopStreaming } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [memoryNotes, setMemoryNotes] = useState<string[]>(['Key insights from conversations will appear here.']);

  const hasMessages = messages.length > 0;

  const selectedModel = useMemo(
    () => MODEL_OPTIONS.find((m) => m.value === preferredModel) ?? MODEL_OPTIONS[0],
    [preferredModel],
  );

  // Auto-scroll on new messages
  useEffect(() => {
    if (bottomRef.current && scrollRef.current) {
      const scrollContainer = scrollRef.current;
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      });
    }
  }, [messages.length]);

  // Auto-scroll during streaming
  const lastMessage = messages[messages.length - 1];
  const streamingContent = lastMessage?.isStreaming ? lastMessage.content.length : 0;
  useEffect(() => {
    if (streamingContent > 0 && scrollRef.current) {
      const scrollContainer = scrollRef.current;
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      });
    }
  }, [streamingContent]);

  const handleSend = useCallback(() => {
    const content = draft.trim();
    if (!content || isStreaming) return;
    sendMessage(content);
    setDraft('');
  }, [draft, isStreaming, sendMessage]);

  const handleStop = useCallback(() => {
    stopStreaming();
    // Add a message asking if issue
    setTimeout(() => {
      // Since sendMessage adds to messages, perhaps add a system message
      // But for simplicity, perhaps alert or something, but since CLI, perhaps not.
    }, 100);
  }, [stopStreaming]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-dark-900">
      {/* Memory Layer */}
      <div className="bg-dark-800 border-b border-dark-700 px-4 py-2">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-4 w-4 text-accent-green" />
          <span className="text-sm font-medium text-gray-200">Memory & Keypoints</span>
        </div>
        <div className="text-xs text-gray-400 space-y-1 max-h-20 overflow-y-auto">
          {memoryNotes.map((note, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-accent-green">•</span>
              <span>{note}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto',
          'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-dark-700',
        )}
      >
        {isLoadingConversation ? (
          <LoadingSkeleton />
        ) : hasMessages ? (
          <div className="pb-6 pt-2">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        ) : (
          <WelcomeScreen onSendPrompt={sendMessage} />
        )}
      </div>

      {/* Composer */}
      <div className="bg-dark-900 px-4 pb-5 pt-2 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <GradientAIChatInput
            value={draft}
            onChange={setDraft}
            onSend={handleSend}
            onStop={stopStreaming}
            isStreaming={isStreaming}
            placeholder="Ask about any stock, market, or portfolio…"
            modelOptions={[]}
          />
          <p className="mt-2 text-center text-[11px] text-dark-500">
            AlphaSight can make mistakes. Verify critical financial decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
