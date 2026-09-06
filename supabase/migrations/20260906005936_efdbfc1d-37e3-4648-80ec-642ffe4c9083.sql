CREATE OR REPLACE FUNCTION public.guard_learning_workspace_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    IF auth.uid() IS NULL THEN
      RETURN NEW; -- service role / server-side jobs
    END IF;
    IF auth.uid() <> OLD.owner_user_id THEN
      RAISE EXCEPTION 'Only the current workspace owner can transfer ownership';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_learning_workspace_owner ON public.learning_workspaces;
CREATE TRIGGER trg_guard_learning_workspace_owner
BEFORE UPDATE ON public.learning_workspaces
FOR EACH ROW EXECUTE FUNCTION public.guard_learning_workspace_owner();

DROP POLICY IF EXISTS los_ws_update ON public.learning_workspaces;
CREATE POLICY los_ws_update ON public.learning_workspaces
FOR UPDATE
USING (
  owner_user_id = (SELECT auth.uid())
  OR is_los_workspace_staff(id, (SELECT auth.uid()))
)
WITH CHECK (
  owner_user_id = (SELECT auth.uid())
  OR is_los_workspace_staff(id, (SELECT auth.uid()))
);