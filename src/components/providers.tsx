'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/stores/app-store';
import { ThemeProvider } from '@/components/theme-provider';
import type { ChatMessage } from '@/stores/app-store';
import type { Json } from '@/types/database';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const setConversations = useAppStore((s) => s.setConversations);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const setMessages = useAppStore((s) => s.setMessages);
  const setIsLoadingConversation = useAppStore((s) => s.setIsLoadingConversation);
  const setActiveConversation = useAppStore((s) => s.setActiveConversation);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const chatPath = pathname.match(/^\/chat\/([^/]+)$/);
    if (chatPath?.[1]) {
      setActiveConversation(chatPath[1]);
      setActiveView('chat');
      return;
    }
    if (pathname === '/') {
      setActiveConversation(null);
      setActiveView('chat');
    }
  }, [pathname, setActiveConversation, setActiveView]);

  // Close sidebar on small screens by default
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    if (mq.matches) setSidebarOpen(false);

    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [setSidebarOpen]);

  // Load conversations on mount
  useEffect(() => {
    async function loadConversations() {
      try {
        const res = await fetch('/api/conversations');
        if (res.ok) {
          const data = await res.json();
          setConversations(data.conversations || []);
        }
      } catch {
        // silently fail
      }
    }
    loadConversations();
  }, [setConversations]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    async function loadMessages() {
      const conversationId = activeConversationId;
      console.debug('[providers] loading messages for conversation', conversationId);

      // Don't flash the loading skeleton if we're already streaming into this
      // conversation — that wipes the assistant bubble mid-stream and leaves
      // the UI blank until the stream finishes.
      const preState = useAppStore.getState();
      const isActiveStream =
        preState.isStreaming ||
        preState.messages.some(
          (m) =>
            m.conversation_id === conversationId &&
            m.role === 'assistant' &&
            (m.isStreaming || !m.content.trim()),
        );
      if (!isActiveStream) {
        setIsLoadingConversation(true);
      }
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`);
        if (res.ok) {
          const data = await res.json();
          const mappedMessages: ChatMessage[] = (data.messages || []).map(
            (message: {
              id: string;
              conversation_id: string;
              role: 'user' | 'assistant';
              content: string;
              metadata: Json | null;
              created_at: string;
            }) => {
              const rawStockData =
                message.metadata &&
                typeof message.metadata === 'object' &&
                !Array.isArray(message.metadata)
                  ? (
                      message.metadata as {
                        stockData?: unknown;
                      }
                    ).stockData
                  : undefined;

              const stockData = Array.isArray(rawStockData)
                ? rawStockData
                : rawStockData
                  ? [rawStockData]
                  : undefined;
              const rawNews =
                message.metadata &&
                typeof message.metadata === 'object' &&
                !Array.isArray(message.metadata)
                  ? (
                      message.metadata as {
                        news?: unknown;
                      }
                    ).news
                  : undefined;
              const newsData = Array.isArray(rawNews) ? rawNews : undefined;

              return {
                ...message,
                ...(stockData ? { stockData: stockData as ChatMessage['stockData'] } : {}),
                ...(newsData ? { newsData: newsData as ChatMessage['newsData'] } : {}),
              };
            }
          );
          // Guard against race conditions that can wipe optimistic assistant text:
          // if the current conversation has a pending/streaming assistant message,
          // keep local state and skip stale DB hydration for this cycle.
          const state = useAppStore.getState();
          const hasPendingAssistant = state.messages.some(
            (m) =>
              m.conversation_id === conversationId &&
              m.role === 'assistant' &&
              (m.isStreaming || !m.content.trim()),
          );
          if (hasPendingAssistant || state.isStreaming) {
            console.debug('[providers] skipped overwrite due pending assistant', conversationId);
            return;
          }

          // Guard against out-of-order async responses when conversation switches fast.
          if (state.activeConversationId !== conversationId) return;

          // If our local state has fresher assistant text than this DB snapshot,
          // keep local state and wait for the next hydration cycle.
          const localForConv = state.messages.filter((m) => m.conversation_id === conversationId);
          const localAssistantWithText = state.messages.some(
            (m) =>
              m.role === 'assistant' &&
              m.content.trim().length > 0 &&
              // optimistic assistant can briefly have empty conversation_id
              (m.conversation_id === conversationId || !m.conversation_id),
          );
          const mappedAssistantWithText = mappedMessages.some(
            (m) => m.role === 'assistant' && m.content.trim().length > 0,
          );
          const mappedIds = new Set(mappedMessages.map((m) => m.id));
          const hasUnpersistedLocalAssistant = state.messages.some(
            (m) =>
              m.role === 'assistant' &&
              m.content.trim().length > 0 &&
              (m.conversation_id === conversationId || !m.conversation_id) &&
              !mappedIds.has(m.id),
          );

          // DB has not caught up with local assistant yet.
          if (localAssistantWithText && (!mappedAssistantWithText || hasUnpersistedLocalAssistant)) {
            console.debug('[providers] keeping local — assistant not yet persisted', conversationId);
            return;
          }

          // If local has more rows than DB (persist delay), keep local.
          if (
            localForConv.length > mappedMessages.length &&
            localForConv.some((m) => m.role === 'assistant' && m.content.trim().length > 0)
          ) {
            console.debug('[providers] keeping local — DB read stale', conversationId);
            return;
          }

          setMessages(mappedMessages);
          console.debug(
            '[providers] loaded messages',
            mappedMessages.length,
            'for',
            conversationId
          );
        }
      } catch {
        // silently fail
      } finally {
        setIsLoadingConversation(false);
      }
    }
    loadMessages();
  }, [activeConversationId, setMessages, setIsLoadingConversation]);

  return <ThemeProvider>{children}</ThemeProvider>;
}
