'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/stores/app-store';
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
      setIsLoadingConversation(true);
      try {
        const res = await fetch(`/api/conversations/${activeConversationId}/messages`);
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
          setMessages(mappedMessages);
        }
      } catch {
        // silently fail
      } finally {
        setIsLoadingConversation(false);
      }
    }
    loadMessages();
  }, [activeConversationId, setMessages, setIsLoadingConversation]);

  return <>{children}</>;
}
