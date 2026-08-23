-- Restrict SECURITY DEFINER helpers from anonymous visitors
REVOKE EXECUTE ON FUNCTION public.current_user_verified_email() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_overall_leaderboard(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_subject_leaderboard(text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_conversation_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_shared_relationship(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_any_los_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_los_workspace_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_los_workspace_staff(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_tutor_user(uuid) FROM anon;

-- Unused-from-client internal routines: not callable from browser sessions
REVOKE EXECUTE ON FUNCTION public.get_published_tutorials(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_ai_usage_today() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_study_memory_context(uuid, text, text, integer) FROM anon, authenticated;