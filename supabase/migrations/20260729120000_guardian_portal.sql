-- ═══════════════════════════════════════════════════════════════════════════
-- Guardian (parent) portal — audit gap #4: parent/payer transparency
--
-- Research context: ~70% of parents are wary of AI grading their children
-- (Pew/PDK), and parents are usually the payer. This gives them a read-only
-- window: who's studying, how often, how scores are trending, and what the
-- subscription status is — WITHOUT giving them write access to anything.
--
-- Design:
--   1. guardian_links — learner-initiated invite codes. The learner stays in
--      control: they create the code, share it with their parent, and can
--      revoke the link at any time.
--   2. accept_guardian_invite(code) — SECURITY DEFINER; the parent redeems
--      the code from their own account.
--   3. get_guardian_learner_overview(learner) — SECURITY DEFINER read-only
--      digest (profile, subscription, 14-day activity, recent sessions).
--      Using an RPC avoids loosening RLS on learning_events/subscriptions.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.guardian_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_user_id uuid NOT NULL,
  guardian_user_id uuid,
  guardian_label text,
  invite_code text NOT NULL UNIQUE DEFAULT upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.guardian_links TO authenticated;
GRANT ALL ON public.guardian_links TO service_role;

ALTER TABLE public.guardian_links ENABLE ROW LEVEL SECURITY;

-- Learners manage their own links (create invites, revoke).
CREATE POLICY "Learners manage own guardian links"
  ON public.guardian_links FOR ALL
  TO authenticated
  USING (auth.uid() = learner_user_id)
  WITH CHECK (auth.uid() = learner_user_id);

-- Guardians can see links pointing at them.
CREATE POLICY "Guardians read own links"
  ON public.guardian_links FOR SELECT
  TO authenticated
  USING (auth.uid() = guardian_user_id);

CREATE INDEX IF NOT EXISTS idx_guardian_links_learner
  ON public.guardian_links (learner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_guardian_links_guardian
  ON public.guardian_links (guardian_user_id, status);

-- ── Accept an invite code ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_guardian_invite(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.guardian_links;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link
  FROM public.guardian_links
  WHERE invite_code = upper(trim(p_code)) AND status = 'invited'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or already-used code');
  END IF;

  IF v_link.learner_user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot link to your own account');
  END IF;

  UPDATE public.guardian_links
  SET guardian_user_id = auth.uid(), status = 'active', accepted_at = now()
  WHERE id = v_link.id;

  RETURN jsonb_build_object('ok', true, 'link_id', v_link.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_guardian_invite(text) TO authenticated;

-- ── Read-only learner overview for an active guardian ───────────────────────
CREATE OR REPLACE FUNCTION public.get_guardian_learner_overview(p_learner uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile jsonb;
  v_sub jsonb;
  v_week jsonb;
  v_recent jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Authorisation: caller must hold an ACTIVE guardian link to this learner.
  IF NOT EXISTS (
    SELECT 1 FROM public.guardian_links
    WHERE guardian_user_id = auth.uid()
      AND learner_user_id = p_learner
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorised for this learner';
  END IF;

  SELECT jsonb_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)
  INTO v_profile
  FROM public.profiles p WHERE p.id = p_learner;

  SELECT jsonb_build_object(
    'plan', s.plan, 'status', s.status,
    'amount', s.amount, 'currency', s.currency,
    'trial_end', s.trial_end
  )
  INTO v_sub
  FROM public.subscriptions s
  WHERE s.user_id = p_learner
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- This week vs last week (7-day windows).
  SELECT jsonb_build_object(
    'sessions_this_week', COUNT(*) FILTER (WHERE occurred_at >= now() - interval '7 days'),
    'sessions_last_week', COUNT(*) FILTER (
      WHERE occurred_at >= now() - interval '14 days'
        AND occurred_at < now() - interval '7 days'),
    'avg_score_this_week', ROUND(AVG(score_pct) FILTER (
      WHERE occurred_at >= now() - interval '7 days' AND score_pct IS NOT NULL)::numeric, 1),
    'avg_score_last_week', ROUND(AVG(score_pct) FILTER (
      WHERE occurred_at >= now() - interval '14 days'
        AND occurred_at < now() - interval '7 days' AND score_pct IS NOT NULL)::numeric, 1)
  )
  INTO v_week
  FROM public.learning_events
  WHERE user_id = p_learner AND occurred_at >= now() - interval '14 days';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'occurred_at', e.occurred_at,
    'source', e.source,
    'topic_name', e.topic_name,
    'score_pct', e.score_pct
  ) ORDER BY e.occurred_at DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT occurred_at, source, topic_name, score_pct
    FROM public.learning_events
    WHERE user_id = p_learner
    ORDER BY occurred_at DESC
    LIMIT 10
  ) e;

  RETURN jsonb_build_object(
    'profile', COALESCE(v_profile, '{}'::jsonb),
    'subscription', v_sub,
    'week', COALESCE(v_week, '{}'::jsonb),
    'recent', v_recent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_guardian_learner_overview(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Teacher class-misconception digest — audit gap #7 companion
--
-- Aggregates marked homework responses per class into the questions students
-- struggled with most, including the concepts tagged on those questions —
-- so a teacher can open class detail and immediately see what to re-teach.
-- SECURITY DEFINER + explicit teacher/school-admin membership check.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_class_misconception_digest(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_items jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT school_id INTO v_school_id FROM public.classes WHERE id = p_class_id;
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF NOT (
    public.is_school_member(v_school_id, 'school_teacher'::app_role)
    OR public.is_school_member(v_school_id, 'school_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorised for this class';
  END IF;

  -- Worst-performing questions across the class's marked homework (last 60d),
  -- minimum 3 marked responses so one struggling student doesn't skew it.
  SELECT COALESCE(jsonb_agg(item ORDER BY (item->>'avg_pct')::numeric ASC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'homework_title', hw.title,
      'homework_topic', hw.topic,
      'prompt', q.prompt,
      'concepts', COALESCE(to_jsonb(q.concepts), '[]'::jsonb),
      'common_mistakes', q.common_mistakes,
      'responses', COUNT(r.id),
      'avg_pct', ROUND(AVG(
        (COALESCE(r.teacher_score, r.ai_score) / NULLIF(q.marks, 0)) * 100
      )::numeric, 1)
    ) AS item
    FROM public.school_homework hw
    JOIN public.school_homework_questions q ON q.homework_id = hw.id
    JOIN public.school_homework_responses r ON r.question_id = q.id
    WHERE hw.class_id = p_class_id
      AND hw.created_at >= now() - interval '60 days'
      AND COALESCE(r.teacher_score, r.ai_score) IS NOT NULL
      AND q.marks > 0
    GROUP BY hw.title, hw.topic, q.id, q.prompt, q.concepts, q.common_mistakes
    HAVING COUNT(r.id) >= 3
       AND AVG((COALESCE(r.teacher_score, r.ai_score) / NULLIF(q.marks, 0)) * 100) < 60
    ORDER BY AVG((COALESCE(r.teacher_score, r.ai_score) / NULLIF(q.marks, 0)) * 100) ASC
    LIMIT 8
  ) t;

  RETURN jsonb_build_object('items', v_items);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_misconception_digest(uuid) TO authenticated;
