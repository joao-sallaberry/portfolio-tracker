-- Exclude specific sales from income tax calculation (UI + Imposto de Renda logic)
ALTER TABLE public.trade_operations
ADD COLUMN IF NOT EXISTS exclude_from_ir boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.trade_operations.exclude_from_ir IS 'When true, the sale is shown on IR page but does not count toward totals, exemption, or accumulated loss.';
