-- Tighten security on Phase 5 objects
ALTER VIEW public.concept_mastery_v SET (security_invoker = true);

REVOKE ALL ON FUNCTION public.sync_weak_concepts_from_attempt() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_weak_concepts_from_attempt() FROM anon;
REVOKE ALL ON FUNCTION public.sync_weak_concepts_from_attempt() FROM authenticated;