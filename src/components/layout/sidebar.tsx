'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  Plus,
  MessageSquare,
  Briefcase,
  Sun,
  Star,
  Settings,
  ChevronLeft,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, type AppView } from '@/stores/app-store';
import type { Conversation } from '@/types/database';

/* ── Date grouping helpers ───────────────────────────────────────── */

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function groupConversations(conversations: Conversation[]) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 86_400_000;
  const sevenDaysAgo = todayStart - 7 * 86_400_000;

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 Days', items: [] },
    { label: 'Older', items: [] },
  ];

  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  for (const conv of sorted) {
    const ts = new Date(conv.updated_at).getTime();
    if (ts >= todayStart) groups[0].items.push(conv);
    else if (ts >= yesterdayStart) groups[1].items.push(conv);
    else if (ts >= sevenDaysAgo) groups[2].items.push(conv);
    else groups[3].items.push(conv);
  }

  return groups.filter((g) => g.items.length > 0);
}

/* ── Nav links ───────────────────────────────────────────────────── */

const navLinks = [
  { view: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { view: 'brief', label: 'Daily Brief', icon: Sun },
  { view: 'watchlist', label: 'Watchlist', icon: Star },
  { view: 'settings', label: 'Settings', icon: Settings },
] as const;

/* ── Sidebar overlay (mobile) ────────────────────────────────────── */

function MobileBackdrop({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-40 bg-black/60 md:hidden"
      onClick={onClick}
    />
  );
}

/* ── Main Sidebar ────────────────────────────────────────────────── */

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const conversations = useAppStore((s) => s.conversations);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const setActiveConversation = useAppStore((s) => s.setActiveConversation);
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const createNewChat = useAppStore((s) => s.createNewChat);
  const deleteConversation = useAppStore((s) => s.deleteConversation);

  const grouped = useMemo(() => groupConversations(conversations), [conversations]);

  const handleNewChat = useCallback(() => {
    createNewChat();
    setActiveView('chat');
    if (pathname !== '/') {
      router.push('/');
    }
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) toggleSidebar();
  }, [createNewChat, pathname, router, setActiveView, toggleSidebar]);

  const handleSelectChat = useCallback(
    (id: string) => {
      setActiveConversation(id);
      setActiveView('chat');
      router.push(`/chat/${id}`);
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile) toggleSidebar();
    },
    [router, setActiveConversation, setActiveView, toggleSidebar]
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/conversations/${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) return;
        deleteConversation(id);
      } catch {
        // ignore delete failures in UI
      }
    },
    [deleteConversation]
  );

  const handleViewSelect = useCallback(
    (view: AppView) => {
      setActiveView(view);
      router.push('/');
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile) toggleSidebar();
    },
    [router, setActiveView, toggleSidebar]
  );

  const sidebarContent = (
    <div className="flex h-full flex-col bg-dark-950 text-sm">
      {/* ── Brand row ────────────────────────── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 px-1">
          <Image src="/logo.svg" alt="AlphaSight" width={20} height={20} />
          <span className="text-[13px] font-semibold tracking-tight text-gray-100">
            AlphaSight
          </span>
        </div>
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-dark-900 hover:text-gray-200"
          aria-label="Close sidebar"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* ── New Chat button ──────────────────── */}
      <div className="px-3 pb-3">
        <button
          onClick={handleNewChat}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-3 py-2',
            'border border-dark-800 bg-dark-900/60 text-[13px] font-medium text-gray-200',
            'transition-all duration-150',
            'hover:border-accent-brand/40 hover:bg-dark-900 hover:text-gray-50',
          )}
        >
          <Plus size={15} strokeWidth={2} />
          <span>New chat</span>
        </button>
      </div>

      {/* ── Chat history ─────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-dark-800">
        {grouped.length === 0 && (
          <p className="px-3 py-8 text-center text-xs text-dark-500">
            No conversations yet
          </p>
        )}
        {grouped.map((group) => (
          <div key={group.label} className="mb-4">
            <h3 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-dark-500">
              {group.label}
            </h3>
            {group.items.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <div
                  key={conv.id}
                  className={cn(
                    'group relative flex cursor-pointer items-center rounded-lg px-3 py-1.5',
                    'transition-colors duration-100',
                    isActive
                      ? 'bg-dark-850 text-gray-50'
                      : 'text-gray-400 hover:bg-dark-900 hover:text-gray-200',
                  )}
                  onClick={() => handleSelectChat(conv.id)}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-accent-brand" />
                  )}
                  <MessageSquare
                    size={13}
                    className={cn(
                      'mr-2.5 shrink-0',
                      isActive ? 'text-accent-brand' : 'text-dark-500',
                    )}
                  />
                  <span className="flex-1 truncate text-[13px]">{conv.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteConversation(conv.id);
                    }}
                    className="ml-1 hidden shrink-0 rounded p-1 text-dark-500 transition-colors hover:bg-dark-800 hover:text-red-400 group-hover:block"
                    aria-label="Delete conversation"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Bottom nav ───────────────────────── */}
      <div className="border-t border-dark-800/80 p-2">
        {navLinks.map((link) => {
          const isActive = activeView === link.view;
          return (
            <button
              key={link.view}
              onClick={() => handleViewSelect(link.view)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px]',
                'transition-colors duration-100',
                isActive
                  ? 'bg-dark-850 text-gray-50'
                  : 'text-gray-400 hover:bg-dark-900 hover:text-gray-200',
              )}
            >
              <link.icon
                size={15}
                className={isActive ? 'text-accent-brand' : undefined}
              />
              <span>{link.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <MobileBackdrop onClick={toggleSidebar} />
        )}
      </AnimatePresence>

      {/* Sidebar - unified for desktop and mobile */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="fixed left-0 top-0 z-40 h-full w-[260px] md:static md:z-auto"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
