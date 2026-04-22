'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, BarChart3, Globe, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WelcomeScreenProps {
  onSendPrompt: (prompt: string) => void;
}

const suggestions = [
  {
    icon: TrendingUp,
    label: 'Analyze Apple (AAPL)',
    prompt: 'Analyze Apple stock',
    description: 'Price action, fundamentals & outlook',
  },
  {
    icon: BarChart3,
    label: 'Reliance deep dive',
    prompt: 'Reliance Industries deep dive',
    description: 'Comprehensive analysis of RIL',
  },
  {
    icon: Globe,
    label: 'US market outlook',
    prompt: "What's happening in US markets today?",
    description: 'Indices, sectors & macro trends',
  },
  {
    icon: ArrowLeftRight,
    label: 'Compare TCS vs Infosys',
    prompt: 'Compare TCS vs Infosys',
    description: 'Head-to-head IT sector comparison',
  },
];

function SparkleMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className="h-10 w-10 text-accent-brand"
      aria-hidden="true"
    >
      <path
        d="M16 3.5 18.1 12 26.6 14.1 18.1 16.2 16 24.7 13.9 16.2 5.4 14.1 13.9 12 16 3.5Z"
        fill="currentColor"
        fillOpacity="0.95"
      />
      <path
        d="M25 4 25.9 7.2 29 8.1 25.9 9 25 12.1 24.1 9 21 8.1 24.1 7.2 25 4Z"
        fill="currentColor"
        fillOpacity="0.55"
      />
    </svg>
  );
}

export function WelcomeScreen({ onSendPrompt }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24 pt-16 sm:pb-16">
      {/* Sparkle mark */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="mb-5"
      >
        <SparkleMark />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="mb-2 text-center text-3xl font-semibold tracking-tight text-gray-100 sm:text-4xl"
      >
        How can I help you today?
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
        className="mb-10 max-w-md text-center text-sm text-dark-400"
      >
        Institutional-grade stock research, on demand. Ask about any company, market, or portfolio.
      </motion.p>

      {/* Suggestion cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2"
      >
        {suggestions.map((s, i) => (
          <motion.button
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 + i * 0.06 }}
            onClick={() => onSendPrompt(s.prompt)}
            className={cn(
              'group relative flex items-start gap-3 overflow-hidden rounded-xl border p-4 text-left',
              'border-dark-800 bg-dark-900/40 backdrop-blur-sm',
              'transition-all duration-200',
              'hover:border-accent-brand/40 hover:bg-dark-800/60',
            )}
          >
            {/* subtle hover glow */}
            <span
              className={cn(
                'pointer-events-none absolute inset-x-0 top-0 h-px',
                'bg-gradient-to-r from-transparent via-accent-brand/40 to-transparent opacity-0',
                'transition-opacity duration-300 group-hover:opacity-100',
              )}
            />

            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                'bg-dark-800 text-dark-400 transition-colors',
                'group-hover:bg-accent-brand-muted group-hover:text-accent-brand',
              )}
            >
              <s.icon className="h-[15px] w-[15px]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-200 transition-colors group-hover:text-gray-50">
                {s.label}
              </div>
              <div className="mt-0.5 text-[12px] text-dark-500">{s.description}</div>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
