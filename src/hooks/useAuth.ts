/**
 * useAuth — shared authentication hook.
 *
 * Replaces the near-identical `supabase.auth.onAuthStateChange` +
 * `supabase.auth.getSession` patterns that were duplicated in
 * LearnerApp, TutorApp, LearnerAuth, and TutorAuth.
 *
 * Usage:
 *   const { session, loading } = useAuth('/learner/auth');
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UseAuthOptions {
  /** If set, redirect to this path when there is no active session. */
  redirectTo?: string;
  /** If set, redirect to this path when a session IS found (e.g. on login pages). */
  redirectIfFound?: string;
}

export const useAuth = (options: UseAuthOptions = {}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Subscribe to future auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setLoading(false);

        if (!newSession?.user && options.redirectTo) {
          navigate(options.redirectTo);
        }
        if (newSession?.user && options.redirectIfFound) {
          navigate(options.redirectIfFound);
        }
      }
    );

    // Bootstrap from existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setLoading(false);

      if (!existingSession?.user && options.redirectTo) {
        navigate(options.redirectTo);
      }
      if (existingSession?.user && options.redirectIfFound) {
        navigate(options.redirectIfFound);
      }
    });

    return () => subscription.unsubscribe();
    // navigate is stable; option strings are primitives — safe to include
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.redirectTo, options.redirectIfFound]);

  return { session, loading };
};
