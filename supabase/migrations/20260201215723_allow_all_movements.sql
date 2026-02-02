-- Remove strict constraint
ALTER TABLE public.trade_operations 
DROP CONSTRAINT IF EXISTS trade_operations_movement_type_check;

-- Add updated constraint with all supported types
ALTER TABLE public.trade_operations 
ADD CONSTRAINT trade_operations_movement_type_check 
CHECK (movement_type IN ('BUY', 'SELL', 'SPLIT', 'REVERSE_SPLIT', 'BONUS', 'AMORTIZATION'));
