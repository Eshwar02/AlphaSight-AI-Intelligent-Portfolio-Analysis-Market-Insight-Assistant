'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, User, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';

export function Header() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-dark-700/50 bg-dark-900 px-3">
      {/* ── Left: toggle sidebar ───────────────── */}
      <div className="flex items-center">
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-dark-850 hover:text-gray-200"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
        )}
      </div>

      {/* ── Center: model label ────────────────── */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <span className="text-sm font-medium text-gray-400">
          AlphaSight Pro
        </span>
      </div>

      {/* ── Right: user menu ───────────────────── */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen((p) => !p)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-green text-sm font-semibold text-dark-950 transition-opacity hover:opacity-90"
          aria-label="User menu"
        >
          A
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-10 z-50 w-48 overflow-hidden rounded-lg border border-dark-700 bg-dark-800 py-1 shadow-xl">
            <button
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-dark-850"
              onClick={() => setMenuOpen(false)}
            >
              <User size={15} />
              <span>Profile</span>
            </button>
            <div className="my-1 border-t border-dark-700" />
            <button
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400 transition-colors hover:bg-dark-850"
              onClick={() => {
                setMenuOpen(false);
                /* Sign out logic handled by auth layer */
              }}
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
