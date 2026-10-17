-- Initial accumulated loss per tax group and year, entered on the IR page
CREATE TABLE public.ir_initial_losses (
  user_id TEXT NOT NULL,
  tax_group TEXT NOT NULL CHECK (tax_group IN ('Ações e ETFs', 'FIIs', 'Isentos')),
  year INTEGER NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount <= 0),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tax_group, year)
);

ALTER TABLE public.ir_initial_losses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ir_initial_losses"
ON public.ir_initial_losses FOR SELECT
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own ir_initial_losses"
ON public.ir_initial_losses FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own ir_initial_losses"
ON public.ir_initial_losses FOR UPDATE
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own ir_initial_losses"
ON public.ir_initial_losses FOR DELETE
USING (auth.uid()::text = user_id);
