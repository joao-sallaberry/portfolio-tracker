-- Drop UNIQUE indexes to allow legitimate duplicates (e.g. multiple trades of same stock on same day)
DROP INDEX IF EXISTS idx_dividend_events_dedupe;
DROP INDEX IF EXISTS idx_trade_operations_dedupe;

-- Re-create them as NON-UNIQUE normal indexes for performance
CREATE INDEX idx_dividend_events_dedupe_lookup ON public.dividend_events(
  user_id, ticker, payment_date, event_type, institution, quantity, unit_price, net_value
);

CREATE INDEX idx_trade_operations_dedupe_lookup ON public.trade_operations(
  user_id, trade_date, movement_type, market, institution, ticker, quantity, price, total_value
);
