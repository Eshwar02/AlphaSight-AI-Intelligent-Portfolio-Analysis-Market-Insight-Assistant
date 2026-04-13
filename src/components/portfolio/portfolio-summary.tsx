'use client';

import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import type { PortfolioHolding } from '@/types/stock';

interface PortfolioSummaryProps {
  holdings: PortfolioHolding[];
}

function PortfolioSummary({ holdings }: PortfolioSummaryProps) {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalCost = holdings.reduce(
    (sum, h) => sum + h.quantity * h.avg_buy_price,
    0
  );
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const best = holdings.length
    ? holdings.reduce((a, b) => (a.pnlPercent > b.pnlPercent ? a : b))
    : null;
  const worst = holdings.length
    ? holdings.reduce((a, b) => (a.pnlPercent < b.pnlPercent ? a : b))
    : null;

  const cards = [
    {
      label: 'Total Value',
      value: formatCurrency(totalValue),
      icon: DollarSign,
      color: 'text-accent-green',
      bgColor: 'bg-accent-green/10',
    },
    {
      label: 'Total P&L',
      value: `${formatCurrency(Math.abs(totalPnl))} (${formatPercent(totalPnlPercent)})`,
      icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
      color: totalPnl >= 0 ? 'text-accent-green' : 'text-accent-red',
      bgColor:
        totalPnl >= 0 ? 'bg-accent-green/10' : 'bg-accent-red/10',
    },
    {
      label: 'Best Performer',
      value: best ? `${best.symbol} ${formatPercent(best.pnlPercent)}` : '--',
      icon: TrendingUp,
      color: 'text-accent-green',
      bgColor: 'bg-accent-green/10',
    },
    {
      label: 'Worst Performer',
      value: worst
        ? `${worst.symbol} ${formatPercent(worst.pnlPercent)}`
        : '--',
      icon: TrendingDown,
      color: 'text-accent-red',
      bgColor: 'bg-accent-red/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-dark-700 bg-dark-800 p-4 flex items-start gap-3"
          >
            <div
              className={cn(
                'rounded-lg p-2 shrink-0',
                card.bgColor
              )}
            >
              <Icon className={cn('h-5 w-5', card.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-dark-400 font-medium">
                {card.label}
              </p>
              <p
                className={cn(
                  'text-sm font-semibold mt-0.5 truncate',
                  card.label === 'Total Value'
                    ? 'text-gray-100'
                    : card.color
                )}
              >
                {card.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { PortfolioSummary };
