-- UNIFIED SCHEMA FOR PORTFOLIO TRACKER
-- Run this in the Supabase SQL Editor to set up the entire database from scratch.

-- 1. Create Dividend Events Table
CREATE TABLE public.dividend_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL, -- Mandatory owner
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

-- 2. Create Trade Operations Table
CREATE TABLE public.trade_operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL, -- Mandatory owner
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

-- 3. Create Standard Indexes for Performance
CREATE INDEX idx_dividend_events_user_id ON public.dividend_events(user_id);
CREATE INDEX idx_dividend_events_ticker ON public.dividend_events(ticker);
CREATE INDEX idx_dividend_events_payment_date ON public.dividend_events(payment_date);

CREATE INDEX idx_trade_operations_user_id ON public.trade_operations(user_id);
CREATE INDEX idx_trade_operations_ticker ON public.trade_operations(ticker);
CREATE INDEX idx_trade_operations_trade_date ON public.trade_operations(trade_date);

-- 4. Create Unique Indexes (Per User Deduplication)
CREATE UNIQUE INDEX idx_dividend_events_dedupe ON public.dividend_events(
  user_id, ticker, payment_date, event_type, institution, quantity, unit_price, net_value
);

CREATE UNIQUE INDEX idx_trade_operations_dedupe ON public.trade_operations(
  user_id, trade_date, movement_type, market, institution, ticker, quantity, price, total_value
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.dividend_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_operations ENABLE ROW LEVEL SECURITY;

-- 6. Create Security Policies (Users can only access their own data)

-- Policies for dividend_events
CREATE POLICY "Users can view their own dividend_events" 
ON public.dividend_events FOR SELECT 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own dividend_events" 
ON public.dividend_events FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own dividend_events" 
ON public.dividend_events FOR UPDATE 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own dividend_events" 
ON public.dividend_events FOR DELETE 
USING (auth.uid()::text = user_id);

-- Policies for trade_operations
CREATE POLICY "Users can view their own trade_operations" 
ON public.trade_operations FOR SELECT 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own trade_operations" 
ON public.trade_operations FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own trade_operations" 
ON public.trade_operations FOR UPDATE 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own trade_operations" 
ON public.trade_operations FOR DELETE 
USING (auth.uid()::text = user_id);
