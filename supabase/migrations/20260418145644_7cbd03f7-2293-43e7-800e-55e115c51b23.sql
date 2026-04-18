ALTER TABLE public.saved_payment_methods
  ADD COLUMN IF NOT EXISTS paystack_authorization_code text,
  ADD COLUMN IF NOT EXISTS paystack_signature text,
  ADD COLUMN IF NOT EXISTS card_bank text,
  ADD COLUMN IF NOT EXISTS card_exp_month text,
  ADD COLUMN IF NOT EXISTS card_exp_year text;

CREATE INDEX IF NOT EXISTS idx_saved_payment_methods_paystack_sig
  ON public.saved_payment_methods(user_id, paystack_signature)
  WHERE paystack_signature IS NOT NULL;