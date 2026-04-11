
CREATE TABLE public.saved_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'payfast',
  token text NOT NULL,
  card_last4 text,
  card_brand text,
  is_default boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint to avoid duplicate tokens
CREATE UNIQUE INDEX idx_saved_payment_methods_token ON public.saved_payment_methods (user_id, token);

ALTER TABLE public.saved_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved payment methods"
ON public.saved_payment_methods FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved payment methods"
ON public.saved_payment_methods FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved payment methods"
ON public.saved_payment_methods FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved payment methods"
ON public.saved_payment_methods FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_saved_payment_methods_updated_at
BEFORE UPDATE ON public.saved_payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
