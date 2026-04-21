-- Add optional currency column to portfolio_holdings.
-- Nullable so existing rows remain valid; new rows default to USD when unset.

alter table portfolio_holdings
  add column if not exists currency text;
