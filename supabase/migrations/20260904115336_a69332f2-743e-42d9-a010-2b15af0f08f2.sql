REVOKE EXECUTE ON FUNCTION public.recompute_subject_coverage(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_subject_coverage() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.recompute_subject_coverage(uuid) TO service_role;
