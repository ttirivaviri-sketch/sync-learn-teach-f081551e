REVOKE EXECUTE ON FUNCTION public.request_tutor_withdrawal(numeric, text, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.request_tutor_withdrawal(numeric, text, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.resolve_payout_request(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.resolve_payout_request(uuid, text, text) TO authenticated;