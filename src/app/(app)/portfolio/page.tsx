'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
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
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [hoveredHolding, setHoveredHolding] = useState<PortfolioHolding | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [stockCache, setStockCache] = useState<Map<string, any>>(new Map());
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    setDetailsDrawerOpen(true);
  }

  const fetchHoverData = useCallback(async (symbol: string) => {
    if (stockCache.has(symbol)) return stockCache.get(symbol);
    try {
      const res = await fetch(`/api/stock/details/${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setStockCache(prev => new Map(prev.set(symbol, data)));
        return data;
      }
    } catch (err) {
      console.error('Failed to fetch hover data:', err);
    }
    return null;
  }, [stockCache]);

  function handleHoldingHover(holding: PortfolioHolding | null, event?: React.MouseEvent) {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (holding && event) {
      hoverTimeoutRef.current = setTimeout(async () => {
        setHoveredHolding(holding);
        setHoverPosition({ x: event.clientX, y: event.clientY });
        await fetchHoverData(holding.symbol);
      }, 150);
    } else {
      setHoveredHolding(null);
      setHoverPosition(null);
    }
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
                         onMouseEnter={(e) => handleHoldingHover(h, e)}
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
                     onMouseEnter={(e) => handleHoldingHover(h, e)}
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

      {/* Hover Card */}
      {hoveredHolding && hoverPosition && (
        <div
          className="fixed z-50 bg-dark-800 border border-dark-700 rounded-xl p-4 shadow-xl max-w-sm animate-in fade-in-0 zoom-in-95 duration-150"
          style={{
            left: hoverPosition.x + 10,
            top: hoverPosition.y + 10,
            transform: 'translate(0, 0)',
          }}
          onMouseEnter={() => setHoveredHolding(hoveredHolding)} // Keep open
          onMouseLeave={() => setHoveredHolding(null)}
        >
          <HoverCardContent holding={hoveredHolding} data={stockCache.get(hoveredHolding.symbol)} />
        </div>
      )}

      {/* Company Details Drawer */}
      {detailsDrawerOpen && selectedHolding && (
        <CompanyDetailsDrawer
          holding={selectedHolding}
          onClose={() => setDetailsDrawerOpen(false)}
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

// Hover Card Content Component
function HoverCardContent({ holding, data }: { holding: PortfolioHolding; data: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center">
          {/* Logo placeholder */}
          <span className="text-xs font-bold text-gray-300">{holding.symbol[0]}</span>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-100">{holding.name || holding.symbol}</div>
          <div className="text-xs text-gray-400">{holding.symbol}</div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-lg font-semibold text-gray-100">
          {formatCurrency(holding.currentPrice, holding.currency || "USD")}
        </div>
        <div className={cn(
          'text-sm font-medium',
          getChangeColor(holding.pnl)
        )}>
          {formatCurrency(holding.pnl, holding.currency || "USD")} ({formatPercent(holding.pnlPercent)})
        </div>
      </div>
      {data?.history && data.history.length > 0 && (
        <div className="h-16 w-full">
          <MiniChart data={data.history.slice(-50)} /> {/* Last 50 points */}
        </div>
      )}
    </div>
  );
}

// Mini Chart Component
function MiniChart({ data }: { data: any[] }) {
  const points = data.map((d, i) => `${(i / data.length) * 100} ${(1 - (d.close - Math.min(...data.map(d => d.close))) / (Math.max(...data.map(d => d.close)) - Math.min(...data.map(d => d.close)))) * 100}`);
  const pathData = `M${points.join(' L')}`;

  return (
    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d={pathData} fill="none" stroke="#2563EB" strokeWidth="2" />
    </svg>
  );
}

// Company Details Drawer Component
function CompanyDetailsDrawer({ holding, onClose }: { holding: PortfolioHolding; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('summary');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [realTimeData, setRealTimeData] = useState<any>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(`/api/stock/details/${holding.symbol}`);
        if (res.ok) {
          const details = await res.json();
          setData(details);
          setRealTimeData(details.quote); // Initial
        }
      } catch (err) {
        console.error("Failed to fetch details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();

    // Real-time polling every 10 seconds
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/stock/quote?symbol=${holding.symbol}`);
        if (res.ok) {
          const quote = await res.json();
          setRealTimeData(quote);
        }
      } catch (err) {
        console.error("Failed to fetch real-time:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [holding.symbol]);

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'news', label: 'News' },
    { id: 'chart', label: 'Chart' },
    { id: 'stats', label: 'Statistics' },
    { id: 'history', label: 'Historical' },
    { id: 'financials', label: 'Financials' },
    { id: 'analysis', label: 'Analysis' },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-dark-800 border-l border-dark-700 shadow-xl transform transition-transform duration-300 ease-in-out">
      <div className="flex flex-col h-full">
        <div className="sticky top-0 bg-dark-800 z-10 p-6 border-b border-dark-700">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-100">{holding.name || holding.symbol}</h1>
              <p className="text-sm text-gray-400">{holding.symbol}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl">✕</button>
          </div>
        </div>
        <div className="sticky top-0 bg-dark-800 z-10 flex border-b border-dark-700 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 min-w-0 py-3 px-4 text-sm font-medium transition-colors whitespace-nowrap',
                activeTab === tab.id ? 'text-accent-green border-b-2 border-accent-green bg-dark-850' : 'text-gray-400 hover:text-gray-200 hover:bg-dark-850'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="space-y-4">
              <div className="h-8 bg-dark-700 rounded animate-pulse"></div>
              <div className="h-4 bg-dark-700 rounded animate-pulse"></div>
              <div className="h-32 bg-dark-700 rounded animate-pulse"></div>
            </div>
          ) : (
            <div>
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  {realTimeData && (
                    <div className="bg-dark-850 rounded-lg p-4">
                      <div className="text-3xl font-bold text-gray-100 mb-1">
                        {formatCurrency(realTimeData.price)}
                      </div>
                      <div className={cn('text-lg font-medium', getChangeColor(realTimeData.change))}>
                        {formatCurrency(realTimeData.change)} ({formatPercent(realTimeData.changePercent)})
                      </div>
                      <div className="text-sm text-gray-400 mt-2">
                        Volume: {realTimeData.volume?.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {data?.info && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-100 mb-2">About</h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {data.info.description?.slice(0, 300)}...
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Sector</p>
                          <p className="text-sm text-gray-200">{data.info.sector}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Industry</p>
                          <p className="text-sm text-gray-200">{data.info.industry}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Employees</p>
                          <p className="text-sm text-gray-200">{data.info.employees}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Market Cap</p>
                          <p className="text-sm text-gray-200">{formatCurrency(data.quote?.marketCap)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'news' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-100 mb-4">Latest News</h3>
                  {data?.news && data.news.length > 0 ? (
                    <div className="space-y-4">
                      {data.news.slice(0, 5).map((item: any, idx: number) => (
                        <div key={idx} className="border-b border-dark-700 pb-4 last:border-b-0">
                          <h4 className="text-sm font-medium text-gray-100 mb-1">{item.title}</h4>
                          <p className="text-xs text-gray-400 mb-2">{item.source} • {new Date(item.publishedAt).toLocaleDateString()}</p>
                          <p className="text-sm text-gray-300">{item.summary}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400">No recent news available.</p>
                  )}
                </div>
              )}
              {activeTab === 'chart' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-100 mb-4">Price Chart</h3>
                  <div className="h-80 bg-dark-850 rounded-lg p-4">
                    <StockChart data={data?.history || []} />
                  </div>
                </div>
              )}
              {/* Other tabs */}
              {['statistics', 'financials', 'analysis'].includes(activeTab) && (
                <div className="text-center text-gray-400 py-8">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} data coming soon.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Stock Chart Component
function StockChart({ data }: { data: any[] }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data.length) return;

    const chart = createChart(chartContainerRef.current as any, {
      layout: {
        background: { type: ColorType.Solid, color: '#1f2937' },
        textColor: '#d1d5db',
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
    });

    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Convert data to candlestick format
    const candlestickData = data.map((d: any) => ({
      time: Math.floor(new Date(d.date).getTime() / 1000),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candlestickSeries.setData(candlestickData);
    chart.timeScale().fitContent();

    chartRef.current = chart;

    return () => {
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} className="w-full" />;
}

export default function PortfolioPage() {
  return <PortfolioView />;
}






