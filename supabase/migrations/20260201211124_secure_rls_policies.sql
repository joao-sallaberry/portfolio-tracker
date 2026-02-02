-- Drop permissive policies
DROP POLICY "Allow all operations on dividend_events" ON public.dividend_events;
DROP POLICY "Allow all operations on trade_operations" ON public.trade_operations;

-- Create secure policies for dividend_events
CREATE POLICY "Users can view their own dividend_events"
ON public.dividend_events
FOR SELECT
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own dividend_events"
ON public.dividend_events
FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own dividend_events"
ON public.dividend_events
FOR UPDATE
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own dividend_events"
ON public.dividend_events
FOR DELETE
USING (auth.uid()::text = user_id);

-- Create secure policies for trade_operations
CREATE POLICY "Users can view their own trade_operations"
ON public.trade_operations
FOR SELECT
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own trade_operations"
ON public.trade_operations
FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own trade_operations"
ON public.trade_operations
FOR UPDATE
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own trade_operations"
ON public.trade_operations
FOR DELETE
USING (auth.uid()::text = user_id);
