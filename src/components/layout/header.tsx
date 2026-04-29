'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, LogOut, User, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useAppStore } from '@/stores/app-store';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ThemeSwitch } from '@/components/ui/theme-switch-button';
import { PWAInstallButton } from '@/components/ui/pwa-install-button';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const [menuOpen, setMenuOpen] = useState(false);
  const [initial, setInitial] = useState('A');
  const menuRef = useRef<HTMLDivElement>(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [menuOpen]);

  /* Fetch user initial once */
  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      const user = data.user;
      const source = user?.user_metadata?.full_name || user?.email || 'A';
      const first = source.trim().charAt(0).toUpperCase();
      if (first) setInitial(first);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    setMenuOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }, [router]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    setActiveView('chat');
    router.push('/');
  }, [router, setActiveView]);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white/80 px-3 backdrop-blur dark:border-dark-800/80 dark:bg-dark-900/80">
      {/* ── Left: sidebar toggle + back ──────── */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-dark-850 dark:hover:text-gray-100"
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <Menu size={17} />
        </button>
        {pathname !== '/' && (
          <button
            onClick={handleBack}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-dark-850 dark:hover:text-gray-100"
            aria-label="Go back"
          >
            <ArrowLeft size={17} />
          </button>
        )}
      </div>

      {/* ── Center: compact brand (clickable) ── */}
      <button
        onClick={() => {
          setActiveView('chat');
          router.push('/');
        }}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-dark-850 dark:hover:text-gray-100"
        aria-label="Go to chat home"
      >
        <Image src="/logo.svg" alt="AlphaSight" width={14} height={14} />
        <span>AlphaSight</span>
        <span className="text-dark-500">/</span>
        <span className="text-dark-400">Pro</span>
      </button>

      {/* ── Right: PWA install + theme toggle + user avatar + menu ────────── */}
      <div className="flex items-center gap-2">
        <PWAInstallButton />
        <ThemeSwitch />
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full',
              'bg-accent-brand text-sm font-semibold text-dark-950',
              'ring-1 ring-accent-brand/50 ring-offset-2 ring-offset-dark-900',
              'transition-transform hover:scale-105',
            )}
            aria-label="User menu"
          >
            {initial}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 z-50 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-2xl shadow-black/10 dark:border-dark-800 dark:bg-dark-900 dark:shadow-black/40">
              <button
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-850"
                onClick={() => {
                  setMenuOpen(false);
                  setActiveView('settings');
                  router.push('/');
                }}
              >
                <User size={14} />
                <span>Profile</span>
              </button>
              <div className="my-1 border-t border-gray-200 dark:border-dark-800" />
              <button
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-red-500 transition-colors hover:bg-gray-100 dark:text-red-400 dark:hover:bg-dark-850"
                onClick={() => void handleSignOut()}
              >
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
