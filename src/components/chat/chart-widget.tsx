'use client';

import React, { useEffect, useRef, memo } from 'react';
import { cn } from '@/lib/utils';

interface ChartWidgetProps {
  symbol: string;
  exchange?: string;
  className?: string;
  height?: number;
}

/**
 * Convert Yahoo Finance symbol to TradingView format.
 * RELIANCE.NS → NSE:RELIANCE, AAPL + NMS → NASDAQ:AAPL
 */
function toTradingViewSymbol(yahooSymbol: string, exchange?: string): string {
  if (yahooSymbol.endsWith('.NS')) {
    return `NSE:${yahooSymbol.replace('.NS', '')}`;
  }
  if (yahooSymbol.endsWith('.BO')) {
    return `BSE:${yahooSymbol.replace('.BO', '')}`;
  }
  if (exchange) {
    const ex = exchange.toUpperCase();
    if (ex.includes('NASDAQ') || ex === 'NMS' || ex === 'NGM' || ex === 'NCM') {
      return `NASDAQ:${yahooSymbol}`;
    }
    if (ex.includes('NYSE') || ex === 'NYQ' || ex === 'NYS') {
      return `NYSE:${yahooSymbol}`;
    }
    if (ex.includes('AMEX') || ex === 'ASE') {
      return `AMEX:${yahooSymbol}`;
    }
  }
  return yahooSymbol;
}

function ChartWidgetInner({ symbol, exchange, className, height = 400 }: ChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    // Clean up previous widget
    if (scriptRef.current) {
      scriptRef.current.remove();
      scriptRef.current = null;
    }
    container.innerHTML = '';

    const tvSymbol = toTradingViewSymbol(symbol, exchange);

    // Use requestAnimationFrame to ensure the container is painted & attached
    // before injecting the TradingView script (avoids contentWindow errors)
    const rafId = requestAnimationFrame(() => {
      if (cancelled || !containerRef.current) return;

      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'tradingview-widget-container__widget';
      widgetContainer.style.height = '100%';
      widgetContainer.style.width = '100%';

      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = JSON.stringify({
        autosize: true,
        symbol: tvSymbol,
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        backgroundColor: '#202123',
        gridColor: '#2a2b36',
        hide_top_toolbar: false,
        hide_legend: false,
        allow_symbol_change: true,
        save_image: false,
        calendar: false,
        hide_volume: false,
        support_host: 'https://www.tradingview.com',
      });

      containerRef.current.appendChild(widgetContainer);
      containerRef.current.appendChild(script);
      scriptRef.current = script;
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [symbol, exchange]);

  return (
    <div
      className={cn(
        'my-4 overflow-hidden rounded-xl border border-dark-700',
        className,
      )}
      style={{ height }}
    >
      <div
        ref={containerRef}
        className="tradingview-widget-container"
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}

export const ChartWidget = memo(ChartWidgetInner);
