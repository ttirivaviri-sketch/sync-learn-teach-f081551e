-- Add RLS for admins/support on tutor_verifications and restrict update surface

-- Allow admins and support to view all tutor verifications
CREATE POLICY IF NOT EXISTS "Admins and support can view all verifications"
ON public.tutor_verifications
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role)
);

-- Allow admins and support to update (status-only enforced by trigger below)
CREATE POLICY IF NOT EXISTS "Admins and support can update verification status"
ON public.tutor_verifications
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role)
);

-- Enforce that non-owners (e.g., admins/support) may only change verification_status
CREATE OR REPLACE FUNCTION public.enforce_verification_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Owners may update any of their own fields (existing RLS already limits to owner)
  IF auth.uid() IS DISTINCT FROM NEW.user_id THEN
    -- Only verification_status can differ for non-owners
    IF (NEW.id_number IS DISTINCT FROM OLD.id_number)
       OR (NEW.id_document_url IS DISTINCT FROM OLD.id_document_url)
       OR (NEW.police_clearance_url IS DISTINCT FROM OLD.police_clearance_url)
       OR (NEW.profile_photo_url IS DISTINCT FROM OLD.profile_photo_url)
       OR (NEW.user_id IS DISTINCT FROM OLD.user_id)
       OR (NEW.created_at IS DISTINCT FROM OLD.created_at)
       OR (NEW.id IS DISTINCT FROM OLD.id)
    THEN
      RAISE EXCEPTION 'Only verification_status may be modified by non-owners';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger
DROP TRIGGER IF EXISTS enforce_verification_update_trigger ON public.tutor_verifications;
CREATE TRIGGER enforce_verification_update_trigger
BEFORE UPDATE ON public.tutor_verifications
FOR EACH ROW
EXECUTE PROCEDURE public.enforce_verification_update();