'use client';

import { useCallback, useRef } from 'react';
import { useAppStore, type ChatMessage } from '@/stores/app-store';
import { generateId } from '@/lib/utils';

export function useChat() {
  const {
    activeConversationId,
    messages,
    isStreaming,
    addMessage,
    appendToMessage,
    updateMessage,
    setIsStreaming,
    setActiveConversation,
    addConversation,
    setMessages,
  } = useAppStore();

  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        conversation_id: activeConversationId ?? '',
        role: 'user',
        content: content.trim(),
        metadata: null,
        created_at: new Date().toISOString(),
      };

      const assistantMsg: ChatMessage = {
        id: generateId(),
        conversation_id: activeConversationId ?? '',
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
          }),
          signal: abortController.signal,
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.redirected || contentType.includes('text/html')) {
          throw new Error('AUTH_REDIRECT');
        }

        if (!res.ok) {
          throw new Error(`Chat request failed: ${res.status}`);
        }

        const newConvId = res.headers.get('x-conversation-id');
        if (newConvId && !activeConversationId) {
          setActiveConversation(newConvId);
          addConversation({
            id: newConvId,
            user_id: '',
            title: content.trim().slice(0, 60),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const text = decoder.decode(value, { stream: true });
            appendToMessage(assistantMsg.id, text);
          }
        }

        updateMessage(assistantMsg.id, { isStreaming: false });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          updateMessage(assistantMsg.id, {
            isStreaming: false,
            content: didTimeout
              ? 'The response timed out. Please try again.'
              : 'Response was cancelled.',
          });
        } else {
          const message =
            err instanceof Error && err.message === 'AUTH_REDIRECT'
              ? 'Your session expired. Please log in again.'
              : 'Sorry, something went wrong. Please try again.';
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
      messages,
      isStreaming,
      addMessage,
      appendToMessage,
      updateMessage,
      setIsStreaming,
      setActiveConversation,
      addConversation,
    ],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      const filtered = messages.slice(0, -1);
      setMessages(filtered);
      sendMessage(lastUserMsg.content);
    }
  }, [messages, setMessages, sendMessage]);

  return { sendMessage, stopStreaming, retry, isStreaming };
}
