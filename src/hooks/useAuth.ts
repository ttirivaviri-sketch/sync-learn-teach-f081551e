/**
 * useAuth — shared authentication hook.
 *
 * Subscribes to Supabase auth state and (when a user is signed in) watches
 * their profile row for `is_suspended` flips. Suspended users are signed out
 * immediately and bounced to the redirect path with a toast.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseAuthOptions {
  /** If set, redirect to this path when there is no active session. */
  redirectTo?: string;
  /** If set, redirect to this path when a session IS found (e.g. on login pages). */
  redirectIfFound?: string;
}

const enforceNotSuspended = async (
  userId: string,
  onBlocked: () => void,
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_suspended, suspended_reason')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return true;
  if (data.is_suspended) {
    await supabase.auth.signOut();
    toast.error('Account suspended', {
      description: data.suspended_reason || 'Contact support for assistance.',
    });
    onBlocked();
    return false;
  }
  return true;
};

export const useAuth = (options: UseAuthOptions = {}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;

    const watchSuspension = (userId: string) => {
      if (profileChannel) supabase.removeChannel(profileChannel);
      profileChannel = supabase
        .channel(`profile-suspension-${userId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          (payload: any) => {
            if (payload.new?.is_suspended) {
              supabase.auth.signOut().then(() => {
                toast.error('Account suspended', {
                  description: payload.new.suspended_reason || 'Contact support for assistance.',
                });
                if (options.redirectTo) navigate(options.redirectTo);
              });
            }
          },
        )
        .subscribe();
    };

    const stopWatching = () => {
      if (profileChannel) {
        supabase.removeChannel(profileChannel);
        profileChannel = null;
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setLoading(false);

        if (!newSession?.user) {
          stopWatching();
          if (options.redirectTo) navigate(options.redirectTo);
          return;
        }

        // Defer to next tick to avoid recursive supabase calls inside the listener
        setTimeout(async () => {
          const ok = await enforceNotSuspended(newSession.user.id, () => {
            if (options.redirectTo) navigate(options.redirectTo);
          });
          if (ok) {
            watchSuspension(newSession.user.id);
            if (options.redirectIfFound) navigate(options.redirectIfFound);
          }
        }, 0);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setLoading(false);

      if (!existingSession?.user) {
        if (options.redirectTo) navigate(options.redirectTo);
        return;
      }

      const ok = await enforceNotSuspended(existingSession.user.id, () => {
        if (options.redirectTo) navigate(options.redirectTo);
      });
      if (ok) {
        watchSuspension(existingSession.user.id);
        if (options.redirectIfFound) navigate(options.redirectIfFound);
      }
    });

    return () => {
      subscription.unsubscribe();
      stopWatching();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.redirectTo, options.redirectIfFound]);

  return { session, loading };
};
