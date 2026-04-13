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
    label: 'Reliance Industries deep dive',
    prompt: 'Reliance Industries deep dive',
    description: 'Comprehensive analysis of RIL',
  },
  {
    icon: Globe,
    label: 'US market outlook today',
    prompt: "What's happening in US markets?",
    description: 'Indices, sectors & macro trends',
  },
  {
    icon: ArrowLeftRight,
    label: 'Compare TCS vs Infosys',
    prompt: 'Compare TCS vs Infosys',
    description: 'Head-to-head IT sector comparison',
  },
];

export function WelcomeScreen({ onSendPrompt }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-20">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-3 text-center"
      >
        <h1 className="bg-gradient-to-r from-gray-100 via-dark-300 to-gray-100 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
          AlphaSight AI
        </h1>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-10 text-center text-base text-dark-400 sm:text-lg"
      >
        Your AI-Powered Stock Intelligence Copilot
      </motion.p>

      {/* Suggestion cards */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {suggestions.map((s, i) => (
          <motion.button
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 + i * 0.07 }}
            onClick={() => onSendPrompt(s.prompt)}
            className={cn(
              'group flex items-start gap-3 rounded-xl border border-dark-700 bg-dark-800 p-4',
              'text-left transition-all duration-200',
              'hover:border-dark-600 hover:bg-dark-850',
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-dark-900 text-dark-400 transition-colors group-hover:text-accent-green">
              <s.icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-200 group-hover:text-gray-100">
                {s.label}
              </div>
              <div className="mt-0.5 text-xs text-dark-500">
                {s.description}
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
