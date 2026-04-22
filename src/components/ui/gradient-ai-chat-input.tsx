'use client';

/**
 * Gradient AI chat input — adapted from the shadcn snippet for AlphaSight.
 *
 * Key differences vs the original:
 *  - Dark-mode only (app doesn't use next-themes).
 *  - Teal/cyan gradient palette to match accent-brand, not the warm amber.
 *  - No file-attach UI (not yet supported by the backend).
 *  - Send button is a ChatGPT-style circular arrow, not the plain Send glyph.
 *  - Exposes `value` + `onChange` + `onStop` + `isStreaming` so it can slot
 *    into the existing `ChatPanel` flow without duplicating state.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { ArrowUp, Square, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModelOption {
  id: string;
  label: string;
  value: string;
  description?: string;
}

interface GradientAIChatInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;

  /** Model picker options. Pass an empty array to hide the dropdown. */
  modelOptions?: ModelOption[];
  selectedModel?: ModelOption | null;
  onModelSelect?: (option: ModelOption) => void;

  enableAnimations?: boolean;
  className?: string;
}

// ── Teal/cyan gradient palette (dark-mode only) ──────────────────────
const MAIN_GRADIENT = {
  topLeft: '#0e7490', // cyan-700
  topRight: '#0d9488', // teal-600
  bottomRight: '#115e59', // teal-800
  bottomLeft: '#1e3a8a', // blue-900 → subtle depth
};

const OUTER_GRADIENT = {
  topLeft: '#083344', // cyan-950
  topRight: '#042f2e', // teal-950
  bottomRight: '#022c22',
  bottomLeft: '#172554',
};

const BUTTON_BORDER = '#3f3f46'; // zinc-700
const SHADOW_COLOR = 'rgb(45, 212, 191)'; // accent-brand

// ── Utils ────────────────────────────────────────────────────────────
function hexToRgba(color: string, alpha: number): string {
  if (color.startsWith('rgb(')) {
    const parts = color.slice(4, -1).split(',').map((v) => parseInt(v.trim(), 10));
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

export function GradientAIChatInput({
  placeholder = 'Send a message...',
  value,
  onChange,
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  modelOptions = [],
  selectedModel,
  onModelSelect,
  enableAnimations = true,
  className,
}: GradientAIChatInputProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimate = enableAnimations && !shouldReduceMotion;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasText = value.trim().length > 0;
  const showDropdown = modelOptions.length > 0;

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isDropdownOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (hasText && !isStreaming && !disabled) {
          onSend();
        }
      }
    },
    [hasText, isStreaming, disabled, onSend],
  );

  return (
    <motion.div
      className={cn('relative', className)}
      initial={shouldAnimate ? { opacity: 0, y: 12 } : {}}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
    >
      <div className="relative">
        {/* Outer 0.5px conic border — deeper palette */}
        <div
          className="absolute inset-0 rounded-[20px] p-[0.5px]"
          style={{
            background: `conic-gradient(from 0deg at 50% 50%,
              ${OUTER_GRADIENT.topLeft} 0deg,
              ${OUTER_GRADIENT.topRight} 90deg,
              ${OUTER_GRADIENT.bottomRight} 180deg,
              ${OUTER_GRADIENT.bottomLeft} 270deg,
              ${OUTER_GRADIENT.topLeft} 360deg)`,
          }}
        >
          {/* Main 2px conic gradient border */}
          <div
            className="h-full w-full rounded-[19.5px] p-[2px]"
            style={{
              background: `conic-gradient(from 0deg at 50% 50%,
                ${MAIN_GRADIENT.topLeft} 0deg,
                ${MAIN_GRADIENT.topRight} 90deg,
                ${MAIN_GRADIENT.bottomRight} 180deg,
                ${MAIN_GRADIENT.bottomLeft} 270deg,
                ${MAIN_GRADIENT.topLeft} 360deg)`,
            }}
          >
            {/* Inner surface — app background */}
            <div className="relative h-full w-full rounded-[17.5px] bg-dark-900">
              {/* Faint inner tint using the same gradient at low opacity */}
              <div
                className="absolute inset-0 rounded-[17.5px] p-[0.5px]"
                style={{
                  background: `conic-gradient(from 0deg at 50% 50%,
                    ${hexToRgba(OUTER_GRADIENT.topLeft, 0.1)} 0deg,
                    ${hexToRgba(OUTER_GRADIENT.topRight, 0.1)} 90deg,
                    ${hexToRgba(OUTER_GRADIENT.bottomRight, 0.1)} 180deg,
                    ${hexToRgba(OUTER_GRADIENT.bottomLeft, 0.1)} 270deg,
                    ${hexToRgba(OUTER_GRADIENT.topLeft, 0.1)} 360deg)`,
                }}
              >
                <div className="h-full w-full rounded-[17px] bg-dark-900" />
              </div>

              {/* Top highlight */}
              <div
                className="absolute left-4 right-4 top-0 h-[0.5px]"
                style={{
                  background: `linear-gradient(to right, transparent, ${hexToRgba(
                    MAIN_GRADIENT.topLeft,
                    0.4,
                  )}, transparent)`,
                }}
              />
              {/* Bottom highlight */}
              <div
                className="absolute bottom-0 left-4 right-4 h-[0.5px]"
                style={{
                  background: `linear-gradient(to right, transparent, ${hexToRgba(
                    MAIN_GRADIENT.bottomRight,
                    0.25,
                  )}, transparent)`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative px-4 pb-3 pt-3.5">
          {/* Row 1 — textarea + circular send */}
          <div className="mb-2 flex items-start gap-3">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className={cn(
                'flex-1 resize-none border-0 bg-transparent px-0 py-1.5',
                'text-[15px] leading-6 text-gray-100 placeholder:text-dark-500',
                'outline-none focus:outline-none focus:ring-0',
                'scrollbar-thin scrollbar-thumb-dark-700',
                disabled && 'cursor-not-allowed opacity-50',
              )}
              style={{ minHeight: 28, maxHeight: 160 }}
            />

            {/* Send / Stop — circular ChatGPT-style */}
            {isStreaming ? (
              <motion.button
                type="button"
                onClick={onStop}
                className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  'bg-dark-700 text-gray-200 transition-colors hover:bg-dark-600',
                )}
                whileHover={shouldAnimate ? { scale: 1.05 } : {}}
                whileTap={shouldAnimate ? { scale: 0.95 } : {}}
                aria-label="Stop generating"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                onClick={() => hasText && !disabled && onSend()}
                disabled={!hasText || disabled}
                className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  'transition-all duration-200',
                  hasText && !disabled
                    ? 'bg-accent-brand text-dark-950 shadow-[0_0_0_1px_rgba(45,212,191,0.4)] hover:bg-accent-brand-hover'
                    : 'cursor-not-allowed bg-dark-700 text-dark-500',
                )}
                whileHover={shouldAnimate && hasText && !disabled ? { scale: 1.05 } : {}}
                whileTap={shouldAnimate && hasText && !disabled ? { scale: 0.92 } : {}}
                aria-label="Send message"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </motion.button>
            )}
          </div>

          {/* Row 2 — model dropdown (only if options provided) */}
          {showDropdown && (
            <div className="flex items-center gap-2">
              <div className="relative" ref={dropdownRef}>
                <motion.button
                  type="button"
                  onClick={() => setIsDropdownOpen((p) => !p)}
                  disabled={disabled}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1',
                    'text-xs font-medium text-gray-300 transition-colors',
                    'bg-dark-850 hover:bg-dark-800 hover:text-gray-100',
                    'border border-dark-700',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                  whileHover={shouldAnimate ? { scale: 1.02 } : {}}
                  whileTap={shouldAnimate ? { scale: 0.98 } : {}}
                  style={{ borderColor: BUTTON_BORDER }}
                  aria-haspopup="listbox"
                  aria-expanded={isDropdownOpen}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-brand" />
                  <span>{selectedModel?.label ?? 'Model'}</span>
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 transition-transform',
                      isDropdownOpen && 'rotate-180',
                    )}
                  />
                </motion.button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.12 }}
                      className={cn(
                        'absolute bottom-full left-0 z-20 mb-2 min-w-[200px]',
                        'rounded-xl border border-dark-700 bg-dark-850',
                        'p-1 shadow-xl shadow-black/40',
                      )}
                      role="listbox"
                    >
                      {modelOptions.map((option) => {
                        const isSelected = selectedModel?.id === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              onModelSelect?.(option);
                              setIsDropdownOpen(false);
                            }}
                            className={cn(
                              'flex w-full items-start gap-2 rounded-lg px-2.5 py-2',
                              'text-left text-xs transition-colors',
                              'hover:bg-dark-800',
                              isSelected
                                ? 'text-gray-100'
                                : 'text-gray-300',
                            )}
                          >
                            <span
                              className={cn(
                                'mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full',
                                isSelected
                                  ? 'bg-accent-brand'
                                  : 'bg-dark-500',
                              )}
                            />
                            <span className="flex-1">
                              <span className="block font-medium">
                                {option.label}
                              </span>
                              {option.description && (
                                <span className="mt-0.5 block text-[11px] text-dark-500">
                                  {option.description}
                                </span>
                              )}
                            </span>
                            {isSelected && (
                              <Check className="mt-0.5 h-3 w-3 shrink-0 text-accent-brand" />
                            )}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <span className="text-[11px] text-dark-500">
                Shift + Enter for newline
              </span>
            </div>
          )}
        </div>

        {/* Soft teal glow underneath */}
        <div
          className="pointer-events-none absolute -bottom-3 left-3 right-3 h-6 rounded-full blur-md"
          style={{
            background: `linear-gradient(to bottom, ${hexToRgba(
              SHADOW_COLOR,
              0.12,
            )} 0%, transparent 100%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-[20px]"
          style={{
            boxShadow: `0 10px 30px ${hexToRgba(SHADOW_COLOR, 0.08)}`,
          }}
        />
      </div>
    </motion.div>
  );
}
