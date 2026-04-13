'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Sun,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Activity,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn, formatCurrency, formatPercent, getChangeColor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import type { DailyBrief, PortfolioSnapshot } from '@/types/stock';

export default function DailyBriefPage() {
  const [briefs, setBriefs] = useState<DailyBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null);

  const fetchBriefs = useCallback(async () => {
    try {
      const res = await fetch('/api/daily-brief');
      if (res.ok) {
        const data = await res.json();
        setBriefs(data.briefs || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefs();
  }, [fetchBriefs]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/daily-brief', { method: 'POST' });
      if (res.ok) {
        await fetchBriefs();
      }
    } catch {
      // silently fail
    } finally {
      setGenerating(false);
    }
  }

  const latestBrief = briefs.length > 0 ? briefs[0] : null;
  const previousBriefs = briefs.slice(1);
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-dark-900">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
              <Sun className="h-6 w-6 text-accent-amber" />
              Daily Portfolio Brief
            </h1>
            <p className="text-sm text-dark-400 mt-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {today}
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            loading={generating}
            size="md"
          >
            <RefreshCw className={cn('h-4 w-4', generating && 'animate-spin')} />
            Generate New Brief
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <div className="rounded-xl border border-dark-700 bg-dark-800 p-6 space-y-4">
              <SkeletonLine className="w-1/3 h-6" />
              <SkeletonLine className="w-full" />
              <SkeletonLine className="w-full" />
              <SkeletonLine className="w-4/5" />
              <SkeletonLine className="w-1/3 h-6 mt-4" />
              <SkeletonLine className="w-full" />
              <SkeletonLine className="w-3/4" />
            </div>
          </div>
        )}

        {/* Generating state */}
        {generating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-accent-green/30 bg-accent-green/5 p-8 text-center mb-6"
          >
            <RefreshCw className="h-8 w-8 text-accent-green animate-spin mx-auto mb-3" />
            <p className="text-gray-100 font-medium">
              Generating your daily brief...
            </p>
            <p className="text-sm text-dark-400 mt-1">
              Analyzing portfolio, market data, and macro risks.
            </p>
          </motion.div>
        )}

        {/* Empty state */}
        {!loading && !generating && briefs.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="rounded-full bg-dark-800 p-6 mb-4">
              <Sun className="h-10 w-10 text-dark-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-100 mb-1">
              No briefs yet
            </h2>
            <p className="text-sm text-dark-400 mb-6">
              Generate your first daily brief to get portfolio insights.
            </p>
            <Button onClick={handleGenerate} loading={generating}>
              <RefreshCw className="h-4 w-4" />
              Generate Your First Brief
            </Button>
          </motion.div>
        )}

        {/* Latest brief */}
        {!loading && latestBrief && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Snapshot cards */}
            <SnapshotCards snapshot={latestBrief.portfolio_snapshot} />

            {/* Top gainers and losers */}
            <GainersLosers snapshot={latestBrief.portfolio_snapshot} />

            {/* Sentiment gauge */}
            <SentimentGauge content={latestBrief.content} />

            {/* Brief content */}
            <div className="rounded-xl border border-dark-700 bg-dark-800 p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-accent-green" />
                Full Analysis
              </h2>
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {latestBrief.content}
                </ReactMarkdown>
              </div>
              <p className="text-xs text-dark-500 mt-4 pt-4 border-t border-dark-700/50">
                Generated{' '}
                {new Date(latestBrief.created_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>

            {/* Previous briefs */}
            {previousBriefs.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-gray-100 mb-3">
                  Previous Briefs
                </h2>
                <div className="space-y-2">
                  {previousBriefs.map((brief) => (
                    <PreviousBriefItem
                      key={brief.id}
                      brief={brief}
                      expanded={expandedBriefId === brief.id}
                      onToggle={() =>
                        setExpandedBriefId(
                          expandedBriefId === brief.id ? null : brief.id
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function SnapshotCards({ snapshot }: { snapshot: PortfolioSnapshot }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
        <p className="text-xs text-dark-400 font-medium mb-1">
          Portfolio Value
        </p>
        <p className="text-xl font-bold text-gray-100">
          {formatCurrency(snapshot.totalValue)}
        </p>
      </div>
      <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
        <p className="text-xs text-dark-400 font-medium mb-1">Total P&L</p>
        <p
          className={cn(
            'text-xl font-bold',
            getChangeColor(snapshot.totalPnl)
          )}
        >
          {formatCurrency(snapshot.totalPnl)}
        </p>
        <Badge
          variant={snapshot.totalPnlPercent >= 0 ? 'green' : 'red'}
          className="mt-1"
        >
          {formatPercent(snapshot.totalPnlPercent)}
        </Badge>
      </div>
      <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
        <p className="text-xs text-dark-400 font-medium mb-1">Holdings</p>
        <p className="text-xl font-bold text-gray-100">
          {snapshot.holdings.length}
        </p>
        <p className="text-xs text-dark-400 mt-1">stocks tracked</p>
      </div>
    </div>
  );
}

function GainersLosers({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const sorted = [...snapshot.holdings].sort(
    (a, b) => b.pnlPercent - a.pnlPercent
  );
  const gainers = sorted.filter((h) => h.pnlPercent > 0).slice(0, 3);
  const losers = sorted.filter((h) => h.pnlPercent < 0).slice(-3).reverse();

  if (gainers.length === 0 && losers.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {gainers.length > 0 && (
        <div className="rounded-xl border border-accent-green/20 bg-accent-green/5 p-4">
          <h3 className="text-sm font-semibold text-accent-green mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Top Gainers
          </h3>
          <div className="space-y-2">
            {gainers.map((h) => (
              <div
                key={h.symbol}
                className="flex items-center justify-between"
              >
                <span className="text-sm font-medium text-gray-100">
                  {h.symbol}
                </span>
                <span className="text-sm font-semibold text-accent-green">
                  {formatPercent(h.pnlPercent)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {losers.length > 0 && (
        <div className="rounded-xl border border-accent-red/20 bg-accent-red/5 p-4">
          <h3 className="text-sm font-semibold text-accent-red mb-3 flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4" />
            Top Losers
          </h3>
          <div className="space-y-2">
            {losers.map((h) => (
              <div
                key={h.symbol}
                className="flex items-center justify-between"
              >
                <span className="text-sm font-medium text-gray-100">
                  {h.symbol}
                </span>
                <span className="text-sm font-semibold text-accent-red">
                  {formatPercent(h.pnlPercent)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SentimentGauge({ content }: { content: string }) {
  const lower = content.toLowerCase();
  let score = 50; // neutral default

  const bullishKeywords = [
    'bullish',
    'upside',
    'growth',
    'positive',
    'outperform',
    'buy',
    'strong',
    'rally',
    'momentum',
  ];
  const bearishKeywords = [
    'bearish',
    'downside',
    'risk',
    'negative',
    'underperform',
    'sell',
    'weak',
    'decline',
    'correction',
  ];

  let bullishCount = 0;
  let bearishCount = 0;
  for (const kw of bullishKeywords) {
    bullishCount += (lower.match(new RegExp(kw, 'g')) || []).length;
  }
  for (const kw of bearishKeywords) {
    bearishCount += (lower.match(new RegExp(kw, 'g')) || []).length;
  }

  const total = bullishCount + bearishCount;
  if (total > 0) {
    score = Math.round((bullishCount / total) * 100);
  }

  const label =
    score >= 70 ? 'Bullish' : score >= 40 ? 'Neutral' : 'Bearish';
  const color =
    score >= 70
      ? 'text-accent-green'
      : score >= 40
        ? 'text-accent-amber'
        : 'text-accent-red';
  const barColor =
    score >= 70
      ? 'bg-accent-green'
      : score >= 40
        ? 'bg-accent-amber'
        : 'bg-accent-red';

  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
      <h3 className="text-sm font-semibold text-gray-100 mb-3 flex items-center gap-1.5">
        <Activity className="h-4 w-4 text-accent-amber" />
        Portfolio Sentiment
      </h3>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="h-2.5 w-full rounded-full bg-dark-700 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', barColor)}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-accent-red">Bearish</span>
            <span className="text-xs text-accent-green">Bullish</span>
          </div>
        </div>
        <div className="text-center shrink-0">
          <p className={cn('text-2xl font-bold', color)}>{score}</p>
          <p className={cn('text-xs font-medium', color)}>{label}</p>
        </div>
      </div>
    </div>
  );
}

function PreviousBriefItem({
  brief,
  expanded,
  onToggle,
}: {
  brief: DailyBrief;
  expanded: boolean;
  onToggle: () => void;
}) {
  const date = new Date(brief.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-dark-850 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-dark-400" />
          <span className="text-gray-300">{date}</span>
          <Badge
            variant={
              brief.portfolio_snapshot.totalPnl >= 0 ? 'green' : 'red'
            }
          >
            {formatPercent(brief.portfolio_snapshot.totalPnlPercent)}
          </Badge>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-dark-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-dark-400" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-dark-700/50">
              <div className="prose prose-sm prose-invert max-w-none mt-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {brief.content}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
