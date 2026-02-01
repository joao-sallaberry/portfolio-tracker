-- Allow importing statements that contain duplicated provento lines (to match broker totals)
-- This index was deduplicating rows with identical content.
DROP INDEX IF EXISTS public.idx_dividend_events_dedupe;

-- Optional: keep a non-unique index for query performance
CREATE INDEX IF NOT EXISTS idx_dividend_events_payment_date ON public.dividend_events (payment_date desc);
CREATE INDEX IF NOT EXISTS idx_dividend_events_ticker ON public.dividend_events (ticker);
