-- Lookup indexes created by the first (Lovable-era) migration. The production database
-- was built from schema_unified.sql and never had them; drop them so that replaying the
-- migrations produces the same schema. No-op where they don't exist.
DROP INDEX IF EXISTS public.idx_dividend_events_event_type;
DROP INDEX IF EXISTS public.idx_dividend_events_institution;
DROP INDEX IF EXISTS public.idx_trade_operations_movement_type;
DROP INDEX IF EXISTS public.idx_trade_operations_institution;
