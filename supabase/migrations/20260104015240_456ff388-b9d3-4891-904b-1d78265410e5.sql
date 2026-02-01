-- Create dividend_events table for "Proventos Recebidos"
CREATE TABLE public.dividend_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_raw TEXT NOT NULL,
  ticker TEXT NOT NULL,
  payment_date DATE NOT NULL,
  event_type TEXT NOT NULL,
  institution TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  net_value NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trade_operations table for "Negociação"
CREATE TABLE public.trade_operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_date DATE NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('BUY', 'SELL')),
  movement_type_raw TEXT NOT NULL,
  market TEXT NOT NULL,
  maturity TEXT,
  institution TEXT NOT NULL,
  ticker TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  total_value NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_dividend_events_ticker ON public.dividend_events(ticker);
CREATE INDEX idx_dividend_events_payment_date ON public.dividend_events(payment_date);
CREATE INDEX idx_dividend_events_event_type ON public.dividend_events(event_type);
CREATE INDEX idx_dividend_events_institution ON public.dividend_events(institution);

CREATE INDEX idx_trade_operations_ticker ON public.trade_operations(ticker);
CREATE INDEX idx_trade_operations_trade_date ON public.trade_operations(trade_date);
CREATE INDEX idx_trade_operations_movement_type ON public.trade_operations(movement_type);
CREATE INDEX idx_trade_operations_institution ON public.trade_operations(institution);

-- Create unique index for deduplication on dividend_events
CREATE UNIQUE INDEX idx_dividend_events_dedupe ON public.dividend_events(
  ticker, payment_date, event_type, institution, quantity, unit_price, net_value
);

-- Create unique index for deduplication on trade_operations
CREATE UNIQUE INDEX idx_trade_operations_dedupe ON public.trade_operations(
  trade_date, movement_type, market, institution, ticker, quantity, price, total_value
);

-- Enable RLS but allow all operations for now (single user app, no auth required)
ALTER TABLE public.dividend_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_operations ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (public access for single user)
CREATE POLICY "Allow all operations on dividend_events" 
ON public.dividend_events 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all operations on trade_operations" 
ON public.trade_operations 
FOR ALL 
USING (true) 
WITH CHECK (true);