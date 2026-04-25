'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore, type ChatMessage } from '@/stores/app-store';
import { generateId } from '@/lib/utils';

const EMPTY_RESPONSE_FALLBACK =
  'Unable to generate analysis right now. Showing available data below.';

function hasVisibleText(value: string): boolean {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim().length > 0;
}

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
      console.debug('[useChat] sendMessage:start', {
        activeConversationId,
        messageLength: userMsg.content.length,
      });

      const abortController = new AbortController();
      abortRef.current = abortController;
      let didTimeout = false;
      let streamingDone = false;
      const timeoutId = setTimeout(() => {
        if (streamingDone) return;
        didTimeout = true;
        try {
          abortController.abort();
        } catch {
          // abort() can throw if the underlying fetch has already settled; ignore
        }
      }, 120000);

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
        console.debug('[useChat] sendMessage:api-response', {
          status: res.status,
          contentType,
          hasBody: Boolean(res.body),
        });
        if (res.redirected || contentType.includes('text/html')) {
          throw new Error('AUTH_REDIRECT');
        }

        // Support structured non-stream responses if backend returns JSON.
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json().catch(() => ({} as Record<string, unknown>));
          const text =
            typeof data.text === 'string'
              ? data.text
              : typeof data.message === 'string'
                ? data.message
                : EMPTY_RESPONSE_FALLBACK;
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: hasVisibleText(text) ? text : EMPTY_RESPONSE_FALLBACK,
          });
          streamingDone = true;
          clearTimeout(timeoutId);
          console.debug('[useChat] sendMessage:json-response-applied', {
            hasText: hasVisibleText(text),
          });
          return;
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMsg = errorData.details || errorData.error || `HTTP ${res.status}`;
          const friendlyMessage =
            res.status === 401
              ? 'Your session expired. Please log in again.'
              : res.status === 503
                ? 'AI service is temporarily unavailable. Please try again in a moment.'
                : `Unable to generate analysis right now. Showing available data below. (${errorMsg})`;
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: friendlyMessage,
          });
          streamingDone = true;
          clearTimeout(timeoutId);
          console.error('[useChat] sendMessage:non-ok', {
            status: res.status,
            errorMsg,
          });
          return;
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
          // Stamp local messages with the new conversation_id FIRST so the
          // providers' loadMessages guard (which filters by conversation_id)
          // can see the pending assistant bubble and skip the DB overwrite.
          updateMessage(userMsg.id, { conversation_id: newConvId });
          updateMessage(assistantMsg.id, { conversation_id: newConvId });
          addConversation({
            id: newConvId,
            user_id: '',
            title: content.trim().slice(0, 60),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          setActiveConversation(newConvId);
          setActiveView('chat');
          router.replace(`/chat/${newConvId}`);
        }

        const reader = res.body?.getReader();
        if (!reader) {
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: EMPTY_RESPONSE_FALLBACK,
          });
          console.error('[useChat] sendMessage:no-reader');
          return;
        }

        const decoder = new TextDecoder();
        let done = false;
        let collectedAny = false;
        let fullAssistantText = '';

        let firstChunkLogged = false;
        while (!done) {
          let readResult: ReadableStreamReadResult<Uint8Array>;
          try {
            readResult = await reader.read();
          } catch (readErr) {
            // reader.read() rejects with AbortError when we abort the fetch
            // on timeout. Let the outer catch handle the UI; just bail out
            // of the loop without surfacing a scary stream error overlay.
            if (readErr instanceof DOMException && readErr.name === 'AbortError') {
              break;
            }
            throw readErr;
          }
          const { value, done: readerDone } = readResult;
          done = readerDone;
          if (value) {
            const text = decoder.decode(value, { stream: true });
            if (text.length > 0) {
              fullAssistantText += text;
              if (hasVisibleText(text)) collectedAny = true;
              if (!firstChunkLogged) {
                firstChunkLogged = true;
                console.debug('[useChat] first-chunk', {
                  preview: text.slice(0, 120),
                  length: text.length,
                });
              }
            }
            appendToMessage(assistantMsg.id, text);
          }
        }
        streamingDone = true;
        clearTimeout(timeoutId);
        console.debug('[useChat] sendMessage:stream-complete', {
          collectedAny,
          chars: fullAssistantText.length,
          visible: hasVisibleText(fullAssistantText),
        });

        // Belt-and-suspenders: if the stream closed without a single chunk,
        // put a visible message into the bubble so it's never blank.
        if (!collectedAny || !hasVisibleText(fullAssistantText)) {
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: EMPTY_RESPONSE_FALLBACK,
          });
        } else {
          updateMessage(assistantMsg.id, { isStreaming: false });
        }

        if (effectiveConversationId) {
          console.debug('[useChat] sendMessage:metadata-hydrate', {
            conversationId: effectiveConversationId,
          });
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
              console.debug('[useChat] sendMessage:metadata-applied', {
                hasStock: Boolean(stockData),
                hasNews: Boolean(newsData),
              });
            }
          }
        }
      } catch (err: unknown) {
        console.error('CHAT ERROR:', err);
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
