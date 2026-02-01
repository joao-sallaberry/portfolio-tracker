-- Drop existing check constraint
ALTER TABLE public.trade_operations DROP CONSTRAINT IF EXISTS trade_operations_movement_type_check;

-- Add updated check constraint with new movement types
ALTER TABLE public.trade_operations ADD CONSTRAINT trade_operations_movement_type_check 
CHECK (movement_type IN ('BUY', 'SELL', 'SPLIT', 'REVERSE_SPLIT'));