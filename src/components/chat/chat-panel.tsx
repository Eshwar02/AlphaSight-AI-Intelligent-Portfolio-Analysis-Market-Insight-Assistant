'use client';

import React, { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useChat } from '@/lib/hooks/use-chat';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { WelcomeScreen } from './welcome-screen';
import { cn } from '@/lib/utils';

function LoadingSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl animate-pulse flex-col gap-6 px-4 py-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="h-7 w-7 shrink-0 rounded-full bg-dark-700" />
          <div className="flex-1 space-y-2.5">
            <div className="h-3 w-16 rounded bg-dark-700" />
            <div className="h-3 w-full rounded bg-dark-700/70" />
            <div className="h-3 w-3/4 rounded bg-dark-700/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatPanel() {
  const { messages, isLoadingConversation, isStreaming } = useAppStore();
  const { sendMessage, stopStreaming } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasMessages = messages.length > 0;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full flex-col bg-dark-900">
      {/* Scrollable message area */}
      <div
        ref={scrollRef}
        className={cn(
          'flex-1 overflow-y-auto',
          'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-dark-700',
        )}
      >
        {isLoadingConversation ? (
          <LoadingSkeleton />
        ) : hasMessages ? (
          <div className="pb-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        ) : (
          <WelcomeScreen onSendPrompt={sendMessage} />
        )}
      </div>

      {/* Sticky input at bottom */}
      <ChatInput
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming}
      />
    </div>
  );
}
