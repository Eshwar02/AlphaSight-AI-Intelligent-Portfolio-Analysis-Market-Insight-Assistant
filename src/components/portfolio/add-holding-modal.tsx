'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PortfolioHolding } from '@/types/stock';

interface AddHoldingModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingHolding?: PortfolioHolding | null;
}

interface SymbolSuggestion {
  symbol: string;
  name: string;
}

function AddHoldingModal({
  open,
  onClose,
  onSaved,
  editingHolding,
}: AddHoldingModalProps) {
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgBuyPrice, setAvgBuyPrice] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'INR' | 'EUR' | 'GBP'>('USD');
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<SymbolSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const isEditing = !!editingHolding;

  useEffect(() => {
    if (editingHolding) {
      setSymbol(editingHolding.symbol);
      setQuantity(String(editingHolding.quantity));
      setAvgBuyPrice(String(editingHolding.avg_buy_price));
      setCurrency(
        (editingHolding.currency as 'USD' | 'INR' | 'EUR' | 'GBP' | null) ||
          'USD',
      );
      setCurrencyTouched(true);
      setNotes(editingHolding.notes || '');
    } else {
      setSymbol('');
      setQuantity('');
      setAvgBuyPrice('');
      setCurrency('USD');
      setCurrencyTouched(false);
      setNotes('');
    }
    setError('');
    setSuggestions([]);
    setShowSuggestions(false);
  }, [editingHolding, open]);

  // Auto-detect currency from symbol suffix unless the user has overridden it.
  useEffect(() => {
    if (currencyTouched) return;
    const upper = symbol.toUpperCase();
    if (upper.endsWith('.NS') || upper.endsWith('.BO')) setCurrency('INR');
    else if (upper.endsWith('.L')) setCurrency('GBP');
    else if (
      upper.endsWith('.PA') ||
      upper.endsWith('.DE') ||
      upper.endsWith('.AS') ||
      upper.endsWith('.MI')
    )
      setCurrency('EUR');
    else setCurrency('USD');
  }, [symbol, currencyTouched]);

  const searchSymbols = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/stock/search?q=${encodeURIComponent(query)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(
          (data.results || []).slice(0, 8).map((r: { symbol: string; name?: string; shortname?: string }) => ({
            symbol: r.symbol,
            name: r.name || r.shortname || r.symbol,
          }))
        );
      }
    } catch {
      // silently fail search
    }
  }, []);

  function handleSymbolChange(value: string) {
    const upper = value.toUpperCase();
    setSymbol(upper);
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchSymbols(upper);
    }, 300);
  }

  function selectSuggestion(s: SymbolSuggestion) {
    setSymbol(s.symbol);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!symbol.trim()) {
      setError('Symbol is required');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    if (!avgBuyPrice || Number(avgBuyPrice) <= 0) {
      setError('Average buy price must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const url = isEditing
        ? `/api/portfolio/${editingHolding!.id}`
        : '/api/portfolio';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          quantity: Number(quantity),
          avgBuyPrice: Number(avgBuyPrice),
          currency,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save holding');
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Holding' : 'Add Holding'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Input
            label="Symbol"
            placeholder="e.g. AAPL"
            value={symbol}
            onChange={(e) => handleSymbolChange(e.target.value)}
            disabled={isEditing}
            autoComplete="off"
          />
          {!isEditing && (
            <Search className="absolute right-3 top-[34px] h-4 w-4 text-dark-500 pointer-events-none" />
          )}
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div
                ref={suggestionsRef}
                className="absolute z-10 mt-1 w-full rounded-lg border border-dark-700 bg-dark-850 shadow-xl overflow-hidden"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {suggestions.map((s) => (
                  <button
                    key={s.symbol}
                    type="button"
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-dark-700 transition-colors flex items-center justify-between"
                  >
                    <span className="font-medium text-gray-100">
                      {s.symbol}
                    </span>
                    <span className="text-xs text-dark-400 truncate ml-2 max-w-[200px]">
                      {s.name}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Input
          label="Quantity"
          type="number"
          placeholder="100"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min="0"
          step="any"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-300">
            Average Buy Price
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="150.00"
              value={avgBuyPrice}
              onChange={(e) => setAvgBuyPrice(e.target.value)}
              min="0"
              step="any"
              className="flex-1 rounded-lg border border-dark-700 bg-dark-850 px-3 py-2 text-sm text-gray-100 placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-green/50 focus:border-accent-green transition-colors"
            />
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value as 'USD' | 'INR' | 'EUR' | 'GBP');
                setCurrencyTouched(true);
              }}
              className="w-24 rounded-lg border border-dark-700 bg-dark-850 px-2 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent-green/50 focus:border-accent-green transition-colors"
            >
              <option value="USD">$ USD</option>
              <option value="INR">₹ INR</option>
              <option value="EUR">€ EUR</option>
              <option value="GBP">£ GBP</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-300">
            Notes (optional)
          </label>
          <textarea
            className="w-full rounded-lg border border-dark-700 bg-dark-850 px-3 py-2 text-sm text-gray-100 placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-green/50 focus:border-accent-green resize-none transition-colors"
            rows={3}
            placeholder="Any notes about this position..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isEditing ? 'Update' : 'Add Holding'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export { AddHoldingModal };
