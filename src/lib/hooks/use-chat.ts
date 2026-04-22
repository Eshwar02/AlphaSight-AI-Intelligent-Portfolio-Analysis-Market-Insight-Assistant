'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore, type ChatMessage } from '@/stores/app-store';
import { generateId } from '@/lib/utils';

const EMPTY_RESPONSE_FALLBACK =
  'Unable to generate analysis right now. Showing available data below.';

export function useChat() {
  const router = useRouter();
  const {
    activeConversationId,
    messages,
    isStreaming,
    preferredModel,
    addMessage,
    appendToMessage,
    updateMessage,
    setIsStreaming,
    setActiveConversation,
    setActiveView,
    addConversation,
    setMessages,
  } = useAppStore();

  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        conversation_id: activeConversationId || '',
        role: 'user',
        content: content.trim(),
        metadata: null,
        created_at: new Date().toISOString(),
      };

      const assistantMsg: ChatMessage = {
        id: generateId(),
        conversation_id: activeConversationId || '',
        role: 'assistant',
        content: '',
        metadata: null,
        created_at: new Date().toISOString(),
        isStreaming: true,
      };

      addMessage(userMsg);
      addMessage(assistantMsg);
      setIsStreaming(true);

      const abortController = new AbortController();
      abortRef.current = abortController;
      let didTimeout = false;
      const timeoutId = setTimeout(() => {
        didTimeout = true;
        abortController.abort();
      }, 60000);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMsg.content,
            conversationId: activeConversationId,
            model: preferredModel,
          }),
          signal: abortController.signal,
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.redirected || contentType.includes('text/html')) {
          throw new Error('AUTH_REDIRECT');
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMsg = errorData.details || errorData.error || `HTTP ${res.status}`;
          throw new Error(`Chat request failed: ${res.status} - ${errorMsg}`);
        }

        // The server sends a short placeholder so the chart can render
        // immediately. Full quote data is rehydrated from DB metadata when the
        // conversation loads (see providers.tsx).
        const stockSymbol = res.headers.get('x-stock-symbol');
        const stockExchange = res.headers.get('x-stock-exchange') || '';
        if (stockSymbol) {
          const placeholder = {
            symbol: stockSymbol,
            exchange: stockExchange,
          } as NonNullable<ChatMessage['stockData']>[number];
          updateMessage(assistantMsg.id, { stockData: [placeholder] });
        }

        const newConvId = res.headers.get('x-conversation-id');
        const effectiveConversationId = newConvId || activeConversationId;
        if (newConvId && !activeConversationId) {
          setActiveConversation(newConvId);
          setActiveView('chat');
          addConversation({
            id: newConvId,
            user_id: '',
            title: content.trim().slice(0, 60),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          // Update user and assistant message IDs with new conversation ID
          updateMessage(userMsg.id, { conversation_id: newConvId });
          updateMessage(assistantMsg.id, { conversation_id: newConvId });
          router.replace(`/chat/${newConvId}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let done = false;
        let collectedAny = false;
        let fullAssistantText = '';

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const text = decoder.decode(value, { stream: true });
            if (text.length > 0) {
              fullAssistantText += text;
              if (text.trim().length > 0) collectedAny = true;
            }
            appendToMessage(assistantMsg.id, text);
          }
        }

        // Belt-and-suspenders: if the stream closed without a single chunk,
        // put a visible message into the bubble so it's never blank.
        if (!collectedAny || fullAssistantText.trim().length === 0) {
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: EMPTY_RESPONSE_FALLBACK,
          });
        } else {
          updateMessage(assistantMsg.id, { isStreaming: false });
        }

        if (effectiveConversationId) {
          const hydrateRes = await fetch(
            `/api/conversations/${effectiveConversationId}/messages?limit=200`
          );
          if (hydrateRes.ok) {
            const hydrateData = await hydrateRes.json();
            const latestAssistant = [...(hydrateData.messages || [])]
              .reverse()
              .find(
                (m: { role?: string; metadata?: unknown; content?: string }) =>
                  m.role === 'assistant' && typeof m.content === 'string'
              );
            if (latestAssistant?.metadata && typeof latestAssistant.metadata === 'object') {
              const md = latestAssistant.metadata as {
                stockData?: unknown;
                news?: unknown;
              };
              const stockData = Array.isArray(md.stockData)
                ? md.stockData
                : md.stockData
                  ? [md.stockData]
                  : undefined;
              const newsData = Array.isArray(md.news) ? md.news : undefined;
              updateMessage(assistantMsg.id, {
                ...(stockData ? { stockData: stockData as ChatMessage['stockData'] } : {}),
                ...(newsData ? { newsData: newsData as ChatMessage['newsData'] } : {}),
              });
            }
          }
        }
      } catch (err: unknown) {
        console.error('[useChat] sendMessage error:', err);
        if (err instanceof DOMException && err.name === 'AbortError') {
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: didTimeout
              ? 'The response timed out. Please try again.'
              : 'Response was cancelled.',
          });
        } else {
          const isAuthRedirect = err instanceof Error && err.message === 'AUTH_REDIRECT';
          const message = isAuthRedirect
            ? 'Your session expired. Please log in again.'
            : `Sorry, something went wrong. Please try again.${err instanceof Error ? ` (${err.message})` : ''}`;
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: message,
          });
        }
      } finally {
        clearTimeout(timeoutId);
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [
      activeConversationId,
      isStreaming,
      preferredModel,
      addMessage,
      appendToMessage,
      updateMessage,
      setIsStreaming,
      setActiveConversation,
      setActiveView,
      addConversation,
      router,
    ],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      // Remove both the failed assistant reply and the user message that triggered it
      const lastUserIdx = messages.lastIndexOf(lastUserMsg);
      const filtered = messages.slice(0, lastUserIdx);
      setMessages(filtered);
      sendMessage(lastUserMsg.content);
    }
  }, [messages, setMessages, sendMessage]);

  return { sendMessage, stopStreaming, retry, isStreaming };
}
