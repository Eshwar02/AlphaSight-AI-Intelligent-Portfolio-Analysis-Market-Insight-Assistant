'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Star,
  Search,
} from 'lucide-react';
import { cn, formatCurrency, formatPercent, getChangeColor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';

interface WatchlistStock {
  id: string;
  symbol: string;
  added_at: string;
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
}

export function WatchlistView() {
  const [items, setItems] = useState<WatchlistStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch('/api/watchlist');
      if (res.ok) {
        const data = await res.json();
        setItems(data.watchlist || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const sym = newSymbol.trim().toUpperCase();
    if (!sym) return;
    setError('');
    setAdding(true);

    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add symbol');
      }

      setNewSymbol('');
      fetchWatchlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      const res = await fetch(`/api/watchlist?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    } catch {
      // silently fail
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="bg-dark-900">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Star className="h-6 w-6 text-accent-amber" />
            Watchlist
          </h1>
        </div>

        {/* Add symbol form */}
        <form
          onSubmit={handleAdd}
          className="flex items-end gap-3 mb-6"
        >
          <div className="flex-1">
            <Input
              label="Add Symbol"
              placeholder="e.g. TSLA"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              error={error || undefined}
            />
          </div>
          <Button
            type="submit"
            loading={adding}
            className="shrink-0 mb-[1px]"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </form>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="rounded-full bg-dark-800 p-6 mb-4">
              <Star className="h-10 w-10 text-dark-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-100 mb-1">
              Your watchlist is empty
            </h2>
            <p className="text-sm text-dark-400">
              Add symbols above to start watching stocks.
            </p>
          </motion.div>
        )}

        {/* Stock cards grid */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatePresence>
              {items.map((item) => {
                const change = item.change ?? 0;
                const changePercent = item.changePercent ?? 0;
                const isPositive = change >= 0;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="rounded-xl border border-dark-700 bg-dark-800 p-4 hover:border-dark-600 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-100">
                          {item.symbol}
                        </h3>
                        {item.name && (
                          <p className="text-xs text-dark-400 truncate max-w-[180px]">
                            {item.name}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemove(item.id)}
                        disabled={removingId === item.id}
                        className="rounded-lg p-1.5 text-dark-500 hover:text-accent-red hover:bg-accent-red/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xl font-bold text-gray-100">
                          {item.price != null
                            ? formatCurrency(item.price)
                            : '--'}
                        </p>
                      </div>
                      {item.price != null && (
                        <div className="flex items-center gap-1.5">
                          {isPositive ? (
                            <TrendingUp
                              className={cn(
                                'h-4 w-4',
                                getChangeColor(change)
                              )}
                            />
                          ) : (
                            <TrendingDown
                              className={cn(
                                'h-4 w-4',
                                getChangeColor(change)
                              )}
                            />
                          )}
                          <Badge variant={isPositive ? 'green' : 'red'}>
                            {formatPercent(changePercent)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WatchlistPage() {
  return <WatchlistView />;
}
