'use client';

import { create } from 'zustand';
import type { Conversation, Message, Json } from '@/types/database';
import type { StockQuote } from '@/types/stock';
import type { NewsItem } from '@/types/stock';

// ── Extended chat message with client-side fields ──────────────────

export interface ChatMessage extends Message {
  isStreaming?: boolean;
  stockData?: StockQuote[];
  newsData?: NewsItem[];
}

export type AppView = 'chat' | 'portfolio' | 'brief' | 'watchlist' | 'settings';

// ── Store shape ────────────────────────────────────────────────────

interface AppState {
  /* ── Sidebar ──────────────────────────────── */
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  activeView: AppView;
  setActiveView: (view: AppView) => void;

  /* ── Conversations ────────────────────────── */
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoadingConversation: boolean;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversationTitle: (id: string, title: string) => void;
  createNewChat: () => void;
  deleteConversation: (id: string) => void;

  /* ── Messages ─────────────────────────────── */
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, partial: Partial<ChatMessage>) => void;
  appendToMessage: (id: string, chunk: string) => void;
  updateLastMessage: (content: string) => void;

  /* ── Streaming ────────────────────────────── */
  isStreaming: boolean;
  setStreaming: (streaming: boolean) => void;
  setIsStreaming: (v: boolean) => void;

  /* ── Loading ──────────────────────────────── */
  setIsLoadingConversation: (v: boolean) => void;

  /* ── Model preference (user-selected via composer dropdown) ─────── */
  preferredModel: 'mistral';
  setPreferredModel: (model: 'mistral') => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  /* ── Sidebar ──────────────────────────────── */
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  activeView: 'chat',
  setActiveView: (view) => set({ activeView: view }),

  /* ── Conversations ────────────────────────── */
  conversations: [],
  activeConversationId: null,
  isLoadingConversation: false,

  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addConversation: (conversation) =>
    set((s) => ({ conversations: [conversation, ...s.conversations] })),

  updateConversationTitle: (id, title) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, title } : c,
      ),
    })),

  createNewChat: () => {
    set({ activeConversationId: null, messages: [] });
  },

  deleteConversation: (id) => {
    const { conversations, activeConversationId } = get();
    const updated = conversations.filter((c) => c.id !== id);
    set({
      conversations: updated,
      ...(activeConversationId === id
        ? { activeConversationId: null, messages: [] }
        : {}),
    });
  },

  /* ── Messages ─────────────────────────────── */
  messages: [],
  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),

  updateMessage: (id, partial) =>
    set((s) => {
      const targetIdx = s.messages.findIndex((m) => m.id === id);
      if (targetIdx !== -1) {
        const next = [...s.messages];
        next[targetIdx] = { ...next[targetIdx], ...partial };
        return { messages: next };
      }

      // Fallback for race conditions where DB hydration replaced optimistic IDs
      // while a stream is still in flight: patch a likely current assistant row.
      const fallbackIdx =
        [...s.messages]
          .map((m, i) => ({ m, i }))
          .reverse()
          .find(
            ({ m }) =>
              m.role === 'assistant' &&
              (m.isStreaming ||
                (s.activeConversationId ? m.conversation_id === s.activeConversationId : false)),
          )?.i ??
        [...s.messages]
        .map((m, i) => ({ m, i }))
        .reverse()
        .find(({ m }) => m.role === 'assistant')?.i;
      if (fallbackIdx === undefined) return { messages: s.messages };

      const next = [...s.messages];
      next[fallbackIdx] = { ...next[fallbackIdx], ...partial };
      return { messages: next };
    }),

  appendToMessage: (id, chunk) =>
    set((s) => {
      const targetIdx = s.messages.findIndex((m) => m.id === id);
      if (targetIdx !== -1) {
        const next = [...s.messages];
        next[targetIdx] = {
          ...next[targetIdx],
          content: next[targetIdx].content + chunk,
        };
        return { messages: next };
      }

      // Same fallback strategy as updateMessage to prevent "blank assistant"
      // when optimistic IDs are replaced during stream.
      const fallbackIdx =
        [...s.messages]
          .map((m, i) => ({ m, i }))
          .reverse()
          .find(
            ({ m }) =>
              m.role === 'assistant' &&
              (m.isStreaming ||
                (s.activeConversationId ? m.conversation_id === s.activeConversationId : false)),
          )?.i ??
        [...s.messages]
        .map((m, i) => ({ m, i }))
        .reverse()
        .find(({ m }) => m.role === 'assistant')?.i;
      if (fallbackIdx === undefined) return { messages: s.messages };

      const next = [...s.messages];
      next[fallbackIdx] = {
        ...next[fallbackIdx],
        content: next[fallbackIdx].content + chunk,
      };
      return { messages: next };
    }),

  updateLastMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      if (msgs.length > 0) {
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
      }
      return { messages: msgs };
    }),

  /* ── Streaming ────────────────────────────── */
  isStreaming: false,
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setIsStreaming: (v) => set({ isStreaming: v }),

  /* ── Loading ──────────────────────────────── */
  setIsLoadingConversation: (v) => set({ isLoadingConversation: v }),

  /* ── Model preference ────────────────────── */
  // Mistral-only model selection.
  preferredModel: 'mistral',
  setPreferredModel: (model) => set({ preferredModel: model }),
}));
