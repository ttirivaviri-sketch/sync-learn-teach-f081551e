REVOKE EXECUTE ON FUNCTION public.get_overall_leaderboard FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_subject_leaderboard FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_overall_leaderboard, public.get_subject_leaderboard TO authenticated, service_role;