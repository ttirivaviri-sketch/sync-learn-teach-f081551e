
-- SAIL Task Engine tables

-- Task types and priorities
CREATE TYPE public.sail_task_type AS ENUM ('bug', 'ux', 'backend', 'learning', 'monetization');
CREATE TYPE public.sail_task_status AS ENUM ('pending', 'in_progress', 'review', 'approved', 'rejected', 'deployed');
CREATE TYPE public.sail_risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.sail_agent_type AS ENUM ('debug', 'frontend', 'backend', 'learning', 'monetization', 'reviewer');

-- Core task table
CREATE TABLE public.sail_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type public.sail_task_type NOT NULL,
  priority public.priority_level NOT NULL DEFAULT 'medium',
  status public.sail_task_status NOT NULL DEFAULT 'pending',
  agent public.sail_agent_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  code_patch TEXT,
  risk_level public.sail_risk_level NOT NULL DEFAULT 'low',
  approval_required BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sail_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admin can manage SAIL tasks"
  ON public.sail_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Events detection table (errors, user behavior, metrics)
CREATE TABLE public.sail_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'error', 'user_behavior', 'learning', 'revenue'
  source TEXT NOT NULL,     -- 'console', 'api', 'analytics', 'agent'
  severity public.sail_risk_level NOT NULL DEFAULT 'low',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  task_id UUID REFERENCES public.sail_tasks(id),
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sail_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admin can manage SAIL events"
  ON public.sail_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Agent execution logs
CREATE TABLE public.sail_agent_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.sail_tasks(id) ON DELETE CASCADE,
  agent public.sail_agent_type NOT NULL,
  action TEXT NOT NULL,
  input JSONB DEFAULT '{}'::jsonb,
  output JSONB DEFAULT '{}'::jsonb,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sail_agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admin can view agent logs"
  ON public.sail_agent_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Subscriptions table for monetization
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  payment_provider TEXT DEFAULT 'payfast',
  payment_ref TEXT,
  amount NUMERIC,
  currency TEXT DEFAULT 'ZAR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can manage all subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create free trial subscription for new users
CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, trial_start, trial_end, status)
  VALUES (NEW.id, 'free', now(), now() + interval '7 days', 'trial')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_subscription();

-- Trigger for updated_at
CREATE TRIGGER sail_tasks_updated_at BEFORE UPDATE ON public.sail_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
