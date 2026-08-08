import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * /app — short, shareable entry point.
 * Signed in → straight into the learner app. Otherwise → sign-in / sign-up.
 */
export default function AppRedirect() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setChecking(false);
      navigate(data.session ? '/learner' : '/learner/auth', { replace: true });
    });
    return () => { active = false; };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="sr-only">{checking ? 'Opening StudySync' : 'Redirecting'}</span>
    </div>
  );
}
