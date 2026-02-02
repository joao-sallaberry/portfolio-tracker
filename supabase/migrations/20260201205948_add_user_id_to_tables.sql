-- 1. Add user_id column (initially nullable)
ALTER TABLE public.dividend_events 
ADD COLUMN user_id TEXT;

ALTER TABLE public.trade_operations 
ADD COLUMN user_id TEXT;

-- 2. Backfill existing data with 'joao'
UPDATE public.dividend_events SET user_id = 'joao' WHERE user_id IS NULL;
UPDATE public.trade_operations SET user_id = 'joao' WHERE user_id IS NULL;

-- 3. Make column NOT NULL (now that data is filled)
ALTER TABLE public.dividend_events 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.trade_operations 
ALTER COLUMN user_id SET NOT NULL;

-- 4. Create indexes
CREATE INDEX idx_dividend_events_user_id ON public.dividend_events(user_id);
CREATE INDEX idx_trade_operations_user_id ON public.trade_operations(user_id);

-- 5. Drop old UNIQUE indexes
DROP INDEX idx_dividend_events_dedupe;
DROP INDEX idx_trade_operations_dedupe;

-- 6. Create new UNIQUE indexes including user_id
CREATE UNIQUE INDEX idx_dividend_events_dedupe ON public.dividend_events(
  user_id, ticker, payment_date, event_type, institution, quantity, unit_price, net_value
);

CREATE UNIQUE INDEX idx_trade_operations_dedupe ON public.trade_operations(
  user_id, trade_date, movement_type, market, institution, ticker, quantity, price, total_value
);
