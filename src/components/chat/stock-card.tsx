'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, formatCurrency, formatPercent, formatNumber } from '@/lib/utils';
import type { StockQuote } from '@/types/stock';

interface StockCardProps {
  stock: StockQuote;
}

export function StockCard({ stock }: StockCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isPositive = stock.change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="my-3 overflow-hidden rounded-xl border border-dark-700 bg-dark-900 transition-colors hover:border-dark-600"
    >
      {/* Compact header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-dark-850"
      >
        {/* Icon */}
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            isPositive ? 'bg-accent-green/10' : 'bg-accent-red/10',
          )}
        >
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-accent-green" />
          ) : (
            <TrendingDown className="h-4 w-4 text-accent-red" />
          )}
        </div>

        {/* Symbol + name */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-100">
              {stock.symbol}
            </span>
            <span className="truncate text-xs text-dark-400">
              {stock.name}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-dark-500">{stock.exchange}</div>
        </div>

        {/* Price + change */}
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-gray-100">
            {formatCurrency(stock.price, stock.currency)}
          </div>
          <div
            className={cn(
              'text-xs font-medium',
              isPositive ? 'text-accent-green' : 'text-accent-red',
            )}
          >
            {formatPercent(stock.changePercent)}
          </div>
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 text-dark-500">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-dark-700 px-4 py-3 sm:grid-cols-4">
              <Detail label="Open" value={formatCurrency(stock.open, stock.currency)} />
              <Detail label="Previous Close" value={formatCurrency(stock.previousClose, stock.currency)} />
              <Detail label="Day High" value={formatCurrency(stock.dayHigh, stock.currency)} />
              <Detail label="Day Low" value={formatCurrency(stock.dayLow, stock.currency)} />
              <Detail label="52W High" value={formatCurrency(stock.high52, stock.currency)} />
              <Detail label="52W Low" value={formatCurrency(stock.low52, stock.currency)} />
              <Detail label="Volume" value={formatNumber(stock.volume)} />
              <Detail
                label="Market Cap"
                value={stock.marketCap > 0 ? formatNumber(stock.marketCap) : "N/A"}
              />
              {stock.pe !== null && (
                <Detail label="P/E Ratio" value={stock.pe.toFixed(2)} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-dark-500">{label}</div>
      <div className="text-sm font-medium text-dark-200">{value}</div>
    </div>
  );
}
