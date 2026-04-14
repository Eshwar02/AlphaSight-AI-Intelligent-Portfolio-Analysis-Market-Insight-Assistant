'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
import { useAppStore } from '@/stores/app-store';
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
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/daily-brief', label: 'Daily Brief', icon: Sun },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/settings', label: 'Settings', icon: Settings },
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
  const createNewChat = useAppStore((s) => s.createNewChat);
  const deleteConversation = useAppStore((s) => s.deleteConversation);

  const grouped = useMemo(() => groupConversations(conversations), [conversations]);

  const handleNewChat = useCallback(() => {
    createNewChat();
    if (pathname !== '/') {
      router.push('/');
    }
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) toggleSidebar();
  }, [createNewChat, pathname, router, toggleSidebar]);

  const handleSelectChat = useCallback(
    (id: string) => {
      setActiveConversation(id);
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile) toggleSidebar();
    },
    [setActiveConversation, toggleSidebar]
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

  const sidebarContent = (
    <div className="flex h-full flex-col bg-dark-950 text-sm">
      {/* ── Top bar ──────────────────────────── */}
      <div className="flex items-center justify-between p-3">
        <button
          onClick={handleNewChat}
          className="flex flex-1 items-center gap-2 rounded-lg border border-dark-700 px-3 py-2.5 text-gray-200 transition-colors hover:bg-dark-850"
        >
          <Plus size={16} />
          <span>New Chat</span>
        </button>
        <button
          onClick={toggleSidebar}
          className="ml-2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-dark-850 hover:text-gray-200"
          aria-label="Close sidebar"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* ── Brand ────────────────────────────── */}
      <div className="px-4 pb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-accent-green">
          AlphaSight AI
        </span>
      </div>

      {/* ── Chat history ─────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2">
        {grouped.length === 0 && (
          <p className="px-3 py-8 text-center text-xs text-dark-500">
            No conversations yet
          </p>
        )}
        {grouped.map((group) => (
          <div key={group.label} className="mb-3">
            <h3 className="mb-1 px-3 text-xs font-medium text-dark-500">
              {group.label}
            </h3>
            {group.items.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <div
                  key={conv.id}
                  className={cn(
                    'group relative flex items-center rounded-lg px-3 py-2 cursor-pointer transition-colors',
                    isActive
                      ? 'bg-dark-800 text-gray-100'
                      : 'text-gray-400 hover:bg-dark-850 hover:text-gray-200'
                  )}
                  onClick={() => handleSelectChat(conv.id)}
                >
                  <MessageSquare
                    size={14}
                    className="mr-2.5 shrink-0 text-dark-500"
                  />
                  <span className="flex-1 truncate text-[13px]">
                    {conv.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteConversation(conv.id);
                    }}
                    className="ml-1 hidden shrink-0 rounded p-1 text-dark-500 transition-colors hover:text-red-400 group-hover:block"
                    aria-label="Delete conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Bottom nav ───────────────────────── */}
      <div className="border-t border-dark-800 p-2">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                isActive
                  ? 'bg-dark-800 text-gray-100'
                  : 'text-gray-400 hover:bg-dark-850 hover:text-gray-200'
              )}
            >
              <link.icon size={16} />
              <span>{link.label}</span>
            </Link>
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
