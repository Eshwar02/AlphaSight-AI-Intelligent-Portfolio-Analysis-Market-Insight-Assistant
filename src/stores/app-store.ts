'use client';

import { create } from 'zustand';
import type { Conversation, Message, Json } from '@/types/database';
import type { StockQuote } from '@/types/stock';

// ── Extended chat message with client-side fields ──────────────────

export interface ChatMessage extends Message {
  isStreaming?: boolean;
  stockData?: StockQuote[];
}

// ── Store shape ────────────────────────────────────────────────────

interface AppState {
  /* ── Sidebar ──────────────────────────────── */
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

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
}

export const useAppStore = create<AppState>((set, get) => ({
  /* ── Sidebar ──────────────────────────────── */
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

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
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, ...partial } : m,
      ),
    })),

  appendToMessage: (id, chunk) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + chunk } : m,
      ),
    })),

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
}));
