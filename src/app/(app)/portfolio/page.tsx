'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  Briefcase,
} from 'lucide-react';
import { cn, formatCurrency, formatPercent, getChangeColor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard, SkeletonTableRow } from '@/components/ui/skeleton';
import { PortfolioSummary } from '@/components/portfolio/portfolio-summary';
import { AddHoldingModal } from '@/components/portfolio/add-holding-modal';
import type { PortfolioHolding } from '@/types/stock';

export function PortfolioView() {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] =
    useState<PortfolioHolding | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedHolding, setSelectedHolding] = useState<PortfolioHolding | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [hoveredHolding, setHoveredHolding] = useState<PortfolioHolding | null>(null);

  const fetchHoldings = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio');
      if (res.ok) {
        const data = await res.json();
        setHoldings(data.holdings || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHoldings();
    // Real-time updates every 30 seconds
    const interval = setInterval(fetchHoldings, 30000);
    return () => clearInterval(interval);
  }, [fetchHoldings]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/portfolio/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHoldings((prev) => prev.filter((h) => h.id !== id));
      }
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  }

  function handleEdit(holding: PortfolioHolding) {
    setEditingHolding(holding);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditingHolding(null);
    setModalOpen(true);
  }

  function handleSaved() {
    fetchHoldings();
  }

  function handleHoldingClick(holding: PortfolioHolding) {
    setSelectedHolding(holding);
    setDetailsModalOpen(true);
  }

  function handleHoldingHover(holding: PortfolioHolding | null) {
    setHoveredHolding(holding);
  }

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalCost = holdings.reduce(
    (s, h) => s + h.quantity * h.avg_buy_price,
    0
  );
  const totalPnl = totalValue - totalCost;

  return (
    <div className="bg-gray-50 dark:bg-dark-900">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-accent-green" />
              Portfolio
            </h1>
            {!loading && holdings.length > 0 && (
              <p className="text-sm text-dark-400 mt-1">
                {holdings.length > 0 ? formatCurrency(totalValue, (holdings[0].currency || "USD")) : formatCurrency(totalValue)} total value{' '}
                <span className={cn(getChangeColor(totalPnl))}>
                  ({formatPercent(
                    totalCost > 0 ? (totalPnl / totalCost) * 100 : 0
                  )})
                </span>
              </p>
            )}
          </div>
          <Button onClick={handleAdd} size="md">
            <Plus className="h-4 w-4" />
            Add Holding
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <div className="rounded-xl border border-dark-700 bg-dark-800 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} columns={7} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && holdings.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="rounded-full bg-dark-800 p-6 mb-4">
              <Briefcase className="h-10 w-10 text-dark-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-100 mb-1">
              No holdings yet
            </h2>
            <p className="text-sm text-dark-400 mb-6">
              Add your first stock to start tracking your portfolio.
            </p>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              Add Your First Stock
            </Button>
          </motion.div>
        )}

        {/* Summary + Table */}
        {!loading && holdings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <PortfolioSummary holdings={holdings} />

            {/* Desktop table */}
            <div className="hidden md:block rounded-xl border border-dark-700 bg-dark-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700 text-dark-400 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">Symbol</th>
                    <th className="text-right px-4 py-3 font-medium">Qty</th>
                    <th className="text-right px-4 py-3 font-medium">
                      Avg Price
                    </th>
                    <th className="text-right px-4 py-3 font-medium">
                      Current
                    </th>
                    <th className="text-right px-4 py-3 font-medium">Value</th>
                    <th className="text-right px-4 py-3 font-medium">P&L</th>
                    <th className="text-right px-4 py-3 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {holdings.map((h) => (
                      <motion.tr
                         key={h.id}
                         layout
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         exit={{ opacity: 0, x: -20 }}
                         className="border-b border-dark-700/50 hover:bg-dark-850 transition-colors cursor-pointer"
                         onClick={() => handleHoldingClick(h)}
                         onMouseEnter={() => handleHoldingHover(h)}
                         onMouseLeave={() => handleHoldingHover(null)}
                       >
                        <td className="px-4 py-3"><div><p className="font-semibold text-gray-100">{h.name || h.symbol}</p><p className="text-xs text-dark-400">{h.symbol}</p></div></td>
                        <td className="px-4 py-3 text-right text-gray-300">
                          {h.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300">
                          {formatCurrency(h.avg_buy_price, (h.currency || "USD"))}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-100 font-medium">
                          {formatCurrency(h.currentPrice, (h.currency || "USD"))}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-100 font-medium">
                          {formatCurrency(h.currentValue, (h.currency || "USD"))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end">
                            <span
                              className={cn(
                                'font-medium',
                                getChangeColor(h.pnl)
                              )}
                            >
                              {formatCurrency(h.pnl, (h.currency || "USD"))}
                            </span>
                            <Badge
                              variant={
                                h.pnlPercent >= 0 ? 'green' : 'red'
                              }
                              className="mt-0.5"
                            >
                              {h.pnlPercent >= 0 ? (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              )}
                              {formatPercent(h.pnlPercent)}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEdit(h)}
                              className="rounded-lg p-1.5 text-dark-400 hover:text-gray-200 hover:bg-dark-700 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(h.id)}
                              disabled={deletingId === h.id}
                              className="rounded-lg p-1.5 text-dark-400 hover:text-accent-red hover:bg-accent-red/10 transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              <AnimatePresence>
                {holdings.map((h) => (
                  <motion.div
                     key={h.id}
                     layout
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, x: -20 }}
                     className="rounded-xl border border-dark-700 bg-dark-800 p-4 cursor-pointer"
                     onClick={() => handleHoldingClick(h)}
                     onMouseEnter={() => handleHoldingHover(h)}
                     onMouseLeave={() => handleHoldingHover(null)}
                   >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-semibold text-gray-100 text-base">
                          {h.symbol}
                        </span>
                        <p className="text-xs text-dark-400 mt-0.5">
                          {h.quantity} shares @ {formatCurrency(h.avg_buy_price, (h.currency || "USD"))}
                        </p>
                      </div>
                      <Badge
                        variant={h.pnlPercent >= 0 ? 'green' : 'red'}
                      >
                        {h.pnlPercent >= 0 ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {formatPercent(h.pnlPercent)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div>
                        <p className="text-xs text-dark-400">Current Price</p>
                        <p className="text-gray-100 font-medium">
                          {formatCurrency(h.currentPrice, (h.currency || "USD"))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-dark-400">Current Value</p>
                        <p className="text-gray-100 font-medium">
                          {formatCurrency(h.currentValue, (h.currency || "USD"))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-dark-400">P&L</p>
                        <p
                          className={cn(
                            'font-medium',
                            getChangeColor(h.pnl)
                          )}
                        >
                          {formatCurrency(h.pnl, (h.currency || "USD"))}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1 border-t border-dark-700/50 pt-3">
                      <button
                        onClick={() => handleEdit(h)}
                        className="rounded-lg px-3 py-1.5 text-xs text-dark-400 hover:text-gray-200 hover:bg-dark-700 transition-colors flex items-center gap-1"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(h.id)}
                        disabled={deletingId === h.id}
                        className="rounded-lg px-3 py-1.5 text-xs text-dark-400 hover:text-accent-red hover:bg-accent-red/10 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </div>

      {/* Hover Tooltip */}
      {hoveredHolding && (
        <div className="fixed z-50 bg-dark-800 border border-dark-700 rounded-lg p-3 shadow-lg max-w-xs">
          <div className="text-sm font-medium text-gray-100">{hoveredHolding.name || hoveredHolding.symbol}</div>
          <div className="text-xs text-gray-400 mt-1">
            Price: {formatCurrency(hoveredHolding.currentPrice, hoveredHolding.currency || "USD")}
          </div>
          <div className="text-xs text-gray-400">
            Change: {formatCurrency(hoveredHolding.pnl, hoveredHolding.currency || "USD")} ({formatPercent(hoveredHolding.pnlPercent)})
          </div>
        </div>
      )}

      {/* Company Details Modal */}
      {detailsModalOpen && selectedHolding && (
        <CompanyDetailsModal
          holding={selectedHolding}
          onClose={() => setDetailsModalOpen(false)}
        />
      )}

      <AddHoldingModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingHolding(null);
        }}
        onSaved={handleSaved}
        editingHolding={editingHolding}
      />
    </div>
  );
}

// Company Details Modal Component
function CompanyDetailsModal({ holding, onClose }: { holding: PortfolioHolding; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(`/api/stock/details/${holding.symbol}`);
        if (res.ok) {
          const details = await res.json();
          setData(details);
        }
      } catch (err) {
        console.error("Failed to fetch details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [holding.symbol]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-dark-800 rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-100">{holding.name || holding.symbol}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
          </div>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="space-y-4">
              {data?.quote && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-100">Quote</h3>
                  <p>Price: {formatCurrency(data.quote.price)}</p>
                  <p>Change: {formatCurrency(data.quote.change)} ({formatPercent(data.quote.changePercent)})</p>
                </div>
              )}
              {data?.info && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-100">Company Info</h3>
                  <p>{data.info.description}</p>
                  <p>Sector: {data.info.sector}</p>
                  <p>Industry: {data.info.industry}</p>
                </div>
              )}

              {data?.history && data.history.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-100">Price History</h3>
                  <div className="h-64">
                    {/* Simple chart placeholder */}
                    <p>History data available. Chart implementation needed.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  return <PortfolioView />;
}






