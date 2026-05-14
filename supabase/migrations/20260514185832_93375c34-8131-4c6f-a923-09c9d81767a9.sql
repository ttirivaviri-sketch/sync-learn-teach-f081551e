-- Backup notification trigger: any update to tutor_verifications.verification_status notifies the tutor.
CREATE OR REPLACE FUNCTION public.notify_tutor_verification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NEW.verification_status = 'approved' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (NEW.user_id, 'You''re verified! 🎉',
        'Your tutor account has been approved. You can now start teaching.', 'success');
    ELSIF NEW.verification_status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (NEW.user_id, 'Verification needs attention',
        COALESCE('Your application was not approved: ' || NEW.rejection_reason,
                 'Your application was not approved. Please re-upload your documents.'),
        'warning');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tutor_verification_change ON public.tutor_verifications;
CREATE TRIGGER trg_notify_tutor_verification_change
AFTER UPDATE ON public.tutor_verifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_tutor_verification_change();