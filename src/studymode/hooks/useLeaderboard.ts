import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '../../integrations/supabase/client';

export interface LeaderboardRow {
  rank: number;
  user_id: string;
  xp: number;
  streak: number;
  full_name: string;
  avatar_url: string | null;
}

export interface LeaderboardMe {
  rank: number;
  xp: number;
  streak: number;
  total_participants: number;
  full_name: string;
  avatar_url: string | null;
}

export interface LeaderboardData {
  top: LeaderboardRow[];
  me: LeaderboardMe | null;
  total_participants: number;
}

/**
 * Real-time leaderboard hook.
 * Pass a `subject` for per-subject board, or omit for the global (overall) board.
 */
export function useLeaderboard(curriculum: string | null | undefined, subject?: string) {
  const queryClient = useQueryClient();
  const curr = curriculum && curriculum.trim() ? curriculum : 'ZIMSEC';
  const queryKey = subject ? ['leaderboard', subject, curr] : ['leaderboard', 'overall', curr];
  const debounceRef = useRef<number | null>(null);

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<LeaderboardData> => {
      if (subject) {
        const { data, error } = await supabase.rpc('get_subject_leaderboard' as any, {
          p_curriculum: curr,
          p_subject: subject,
          p_limit: 10,
        });
        if (error) throw error;
        return data as unknown as LeaderboardData;
      }
      const { data, error } = await supabase.rpc('get_overall_leaderboard' as any, {
        p_curriculum: curr,
        p_limit: 10,
      });
      if (error) throw error;
      return data as unknown as LeaderboardData;
    },
    staleTime: 15_000,
  });

  // Realtime subscription
  useEffect(() => {
    const channelName = subject
      ? `subject_xp:${curr}:${subject}`
      : `subject_xp:${curr}:overall`;

    const filter = subject
      ? `curriculum=eq.${curr}`
      : `curriculum=eq.${curr}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'subject_xp', filter },
        () => {
          if (debounceRef.current) window.clearTimeout(debounceRef.current);
          debounceRef.current = window.setTimeout(() => {
            queryClient.invalidateQueries({ queryKey });
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curr, subject]);

  return query;
}
