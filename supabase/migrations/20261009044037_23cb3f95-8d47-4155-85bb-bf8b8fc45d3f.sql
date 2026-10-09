CREATE TABLE public.learner_reengagement_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
 inactive_since timestamptz NOT NULL, step integer NOT NULL DEFAULT 0, last_sent_at timestamptz, stopped_at timestamptz, unsubscribed_at timestamptz,
 delivery_key uuid, claimed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.learner_reengagement_campaigns TO service_role;
ALTER TABLE public.learner_reengagement_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Email service manages campaigns" ON public.learner_reengagement_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER touch_reengagement_campaign BEFORE UPDATE ON public.learner_reengagement_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.claim_learner_reengagement(_limit integer DEFAULT 50)
RETURNS TABLE(campaign_id uuid, learner_id uuid, email text, full_name text, next_step integer, delivery_key uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.learner_reengagement_campaigns(user_id,inactive_since)
 SELECT p.id,greatest(coalesce(p.last_seen,p.created_at),coalesce((SELECT max(l.last_at) FROM public.user_login_days l WHERE l.user_id=p.id),p.created_at),coalesce((SELECT max(a.created_at) FROM public.study_activity a WHERE a.user_id=p.id),p.created_at))
 FROM public.profiles p WHERE p.user_type='learner' AND NOT coalesce(p.is_suspended,false) AND p.email IS NOT NULL
 AND greatest(coalesce(p.last_seen,p.created_at),coalesce((SELECT max(l.last_at) FROM public.user_login_days l WHERE l.user_id=p.id),p.created_at),coalesce((SELECT max(a.created_at) FROM public.study_activity a WHERE a.user_id=p.id),p.created_at)) < now()-interval '5 days'
 ON CONFLICT(user_id) DO NOTHING;
 UPDATE public.learner_reengagement_campaigns c SET stopped_at=now()
 FROM public.profiles p WHERE p.id=c.user_id AND c.stopped_at IS NULL AND (coalesce(p.is_suspended,false) OR p.user_type <> 'learner' OR coalesce(p.last_seen,p.created_at)>c.inactive_since OR EXISTS(SELECT 1 FROM public.user_login_days l WHERE l.user_id=p.id AND l.last_at>c.inactive_since) OR EXISTS(SELECT 1 FROM public.study_activity a WHERE a.user_id=p.id AND a.created_at>c.inactive_since));
 RETURN QUERY
 WITH due AS (
 SELECT c.id FROM public.learner_reengagement_campaigns c WHERE c.stopped_at IS NULL AND c.unsubscribed_at IS NULL AND c.step<3
 AND (c.last_sent_at IS NULL OR c.last_sent_at<=now()-interval '3 days')
 AND (c.claimed_at IS NULL OR c.claimed_at<now()-interval '1 hour')
 ORDER BY c.last_sent_at NULLS FIRST,c.created_at LIMIT least(greatest(_limit,1),100) FOR UPDATE SKIP LOCKED
 ), claimed AS (
 UPDATE public.learner_reengagement_campaigns c SET claimed_at=now(),delivery_key=coalesce(c.delivery_key,gen_random_uuid()) FROM due WHERE c.id=due.id
 RETURNING c.id,c.user_id,c.step,c.delivery_key
 ) SELECT c.id,c.user_id,p.email,p.full_name,c.step+1,c.delivery_key FROM claimed c JOIN public.profiles p ON p.id=c.user_id;
END; $$;
REVOKE ALL ON FUNCTION public.claim_learner_reengagement(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_learner_reengagement(integer) TO service_role;