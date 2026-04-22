'use client';

import { useEffect } from 'react';
import { ChatPanel } from '@/components/chat/chat-panel';
import { useAppStore } from '@/stores/app-store';

export default function ChatConversationPage() {
  const setActiveView = useAppStore((s) => s.setActiveView);
  useEffect(() => {
    setActiveView('chat');
  }, [setActiveView]);
  return <ChatPanel />;
}
