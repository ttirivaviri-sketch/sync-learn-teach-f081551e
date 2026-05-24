
-- Add columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS allocation_id uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'self';

-- tutor_allocations
CREATE TABLE IF NOT EXISTS public.tutor_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL,
  tutor_id uuid NOT NULL,
  tutor_subject_id uuid NOT NULL,
  weekly_schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_date date NOT NULL,
  end_date date NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  price_per_session numeric NOT NULL DEFAULT 0,
  external_payment_reference text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_allocations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_allocation_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_allocation_id_fkey
  FOREIGN KEY (allocation_id) REFERENCES public.tutor_allocations(id) ON DELETE SET NULL;

-- RLS policies
DROP POLICY IF EXISTS "Admins manage allocations" ON public.tutor_allocations;
CREATE POLICY "Admins manage allocations"
  ON public.tutor_allocations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Participants view allocations" ON public.tutor_allocations;
CREATE POLICY "Participants view allocations"
  ON public.tutor_allocations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = learner_id OR auth.uid() = tutor_id);

-- Updated-at trigger
DROP TRIGGER IF EXISTS trg_tutor_allocations_updated_at ON public.tutor_allocations;
CREATE TRIGGER trg_tutor_allocations_updated_at
  BEFORE UPDATE ON public.tutor_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generation function
CREATE OR REPLACE FUNCTION public.generate_allocation_bookings(p_allocation_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alloc public.tutor_allocations;
  v_slot jsonb;
  v_date date;
  v_dow_target int;
  v_time time;
  v_scheduled_at timestamptz;
  v_count int := 0;
  v_room text;
  v_dow_map jsonb := '{"sun":0,"mon":1,"tue":2,"wed":3,"thu":4,"fri":5,"sat":6}'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_alloc FROM public.tutor_allocations WHERE id = p_allocation_id;
  IF v_alloc.id IS NULL THEN
    RAISE EXCEPTION 'Allocation not found';
  END IF;

  FOR v_slot IN SELECT * FROM jsonb_array_elements(v_alloc.weekly_schedule)
  LOOP
    v_dow_target := (v_dow_map ->> lower(v_slot->>'day'))::int;
    v_time := (v_slot->>'time')::time;
    IF v_dow_target IS NULL OR v_time IS NULL THEN CONTINUE; END IF;

    v_date := v_alloc.start_date;
    WHILE v_date <= v_alloc.end_date LOOP
      IF EXTRACT(DOW FROM v_date)::int = v_dow_target THEN
        v_scheduled_at := (v_date::text || ' ' || v_time::text)::timestamptz;

        -- Skip if conflicting booking already exists for tutor or learner
        IF NOT EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE (b.tutor_id = v_alloc.tutor_id OR b.learner_id = v_alloc.learner_id)
            AND b.scheduled_at = v_scheduled_at
            AND b.status IN ('requested','confirmed')
        ) THEN
          v_room := 'session-' || gen_random_uuid()::text;
          INSERT INTO public.bookings (
            learner_id, tutor_id, tutor_subject_id, scheduled_at,
            duration_minutes, price, status, room_name,
            allocation_id, source
          ) VALUES (
            v_alloc.learner_id, v_alloc.tutor_id, v_alloc.tutor_subject_id,
            v_scheduled_at, v_alloc.duration_minutes, v_alloc.price_per_session,
            'requested', v_room, v_alloc.id, 'admin_allocated'
          );
          v_count := v_count + 1;
        END IF;
      END IF;
      v_date := v_date + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Auto-generate on insert
CREATE OR REPLACE FUNCTION public.fn_after_allocation_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.generate_allocation_bookings(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_allocation_insert ON public.tutor_allocations;
CREATE TRIGGER trg_after_allocation_insert
  AFTER INSERT ON public.tutor_allocations
  FOR EACH ROW EXECUTE FUNCTION public.fn_after_allocation_insert();
