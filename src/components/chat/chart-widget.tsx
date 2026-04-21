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
 * TradingView requires an exchange prefix for reliable resolution — a bare
 * ticker like "AAPL" often fails to render. We map common Yahoo suffix and
 * exchange codes; when the exchange is unknown but the symbol looks US-listed
 * we default to NASDAQ (TradingView will auto-redirect to NYSE/AMEX if needed).
 */
function toTradingViewSymbol(yahooSymbol: string, exchange?: string): string {
  // ── Suffix-based routing (exchange hint embedded in the ticker) ──
  const suffixMap: Record<string, string> = {
    '.NS': 'NSE',
    '.BO': 'BSE',
    '.L': 'LSE',
    '.TO': 'TSX',
    '.V': 'TSXV',
    '.HK': 'HKEX',
    '.T': 'TSE',
    '.SS': 'SSE',
    '.SZ': 'SZSE',
    '.PA': 'EURONEXT',
    '.AS': 'EURONEXT',
    '.BR': 'EURONEXT',
    '.DE': 'XETR',
    '.F': 'FWB',
    '.MI': 'MIL',
    '.MC': 'BME',
    '.SW': 'SIX',
    '.AX': 'ASX',
    '.NZ': 'NZX',
    '.SA': 'BMFBOVESPA',
  };
  for (const [suffix, prefix] of Object.entries(suffixMap)) {
    if (yahooSymbol.endsWith(suffix)) {
      return `${prefix}:${yahooSymbol.slice(0, -suffix.length)}`;
    }
  }

  // Crypto pairs (e.g. BTC-USD) — TradingView uses BINANCE/COINBASE prefixes
  if (/^[A-Z]+-USD$/.test(yahooSymbol)) {
    return `BINANCE:${yahooSymbol.replace('-USD', 'USDT')}`;
  }

  // ── Exchange-based routing for US tickers ──
  if (exchange) {
    const ex = exchange.toUpperCase();
    if (
      ex.includes('NASDAQ') ||
      ex === 'NMS' ||
      ex === 'NGM' ||
      ex === 'NCM' ||
      ex === 'NAS'
    ) {
      return `NASDAQ:${yahooSymbol}`;
    }
    if (
      ex.includes('NYSE') ||
      ex === 'NYQ' ||
      ex === 'NYS' ||
      ex === 'PCX' ||
      ex === 'ARCA' ||
      ex === 'NYSEARCA' ||
      ex === 'BATS'
    ) {
      return `NYSE:${yahooSymbol}`;
    }
    if (ex.includes('AMEX') || ex === 'ASE') {
      return `AMEX:${yahooSymbol}`;
    }
  }

  // Unknown exchange but looks like a US ticker (no suffix, uppercase letters
  // only) — default to NASDAQ. TradingView's resolver will surface the
  // correct listing, and `allow_symbol_change: true` lets users adjust.
  if (/^[A-Z][A-Z0-9.-]{0,9}$/.test(yahooSymbol) && !yahooSymbol.includes('.')) {
    return `NASDAQ:${yahooSymbol}`;
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
