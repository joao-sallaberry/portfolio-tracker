-- Fractional-market tickers (PETR4F, TAEE11F) are the same asset as PETR4 / TAEE11.
-- Strip the "F" suffix so positions and IR treat them as one ticker.
-- Same pattern as normalizeTicker() in src/lib/formatters.ts.
-- The fractional origin of trades is kept in trade_operations.market ('Mercado Fracionário').
UPDATE public.trade_operations
SET ticker = regexp_replace(ticker, '^([A-Z0-9]{4}[0-9]{1,2})F$', '\1')
WHERE ticker ~ '^[A-Z0-9]{4}[0-9]{1,2}F$';

UPDATE public.dividend_events
SET ticker = regexp_replace(ticker, '^([A-Z0-9]{4}[0-9]{1,2})F$', '\1')
WHERE ticker ~ '^[A-Z0-9]{4}[0-9]{1,2}F$';
