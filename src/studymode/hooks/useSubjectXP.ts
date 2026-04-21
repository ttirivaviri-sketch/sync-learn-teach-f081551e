import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { logger } from '@/utils/logger';

interface AwardArgs {
  subject: string;
  curriculum?: string | null;
  amount: number;
}

/**
 * Awards XP to a (user, subject, curriculum) row in subject_xp.
 * Updates streak (Duolingo-style: +1 if last activity was yesterday, reset to 1 if older, no change if today).
 */
export function useSubjectXP() {
  const queryClient = useQueryClient();

  const awardXP = useMutation({
    mutationFn: async ({ subject, curriculum, amount }: AwardArgs) => {
      if (!subject || amount <= 0) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const curr = curriculum && curriculum.trim() ? curriculum : 'ZIMSEC';
      const today = new Date().toISOString().split('T')[0];

      // Read existing row
      const { data: existing } = await supabase
        .from('subject_xp' as any)
        .select('xp, streak, last_activity_date')
        .eq('user_id', user.id)
        .eq('subject', subject)
        .eq('curriculum', curr)
        .maybeSingle();

      const existingRow = existing as any;
      let nextStreak = 1;
      const prevDate = existingRow?.last_activity_date as string | null | undefined;
      if (prevDate === today) {
        nextStreak = existingRow?.streak ?? 1;
      } else if (prevDate) {
        const diff = Math.round(
          (new Date(today).getTime() - new Date(prevDate).getTime()) / 86400000
        );
        nextStreak = diff === 1 ? (existingRow?.streak ?? 0) + 1 : 1;
      }

      const nextXp = (existingRow?.xp ?? 0) + amount;

      const { error } = await supabase
        .from('subject_xp' as any)
        .upsert(
          {
            user_id: user.id,
            subject,
            curriculum: curr,
            xp: nextXp,
            streak: nextStreak,
            last_activity_date: today,
          },
          { onConflict: 'user_id,subject,curriculum' }
        );

      if (error) logger.warn('[useSubjectXP] upsert failed', error.message);
      return { subject, curriculum: curr, xp: nextXp, streak: nextStreak };
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard', vars.subject] });
    },
  });

  return { awardXP };
}
