import { useEffect, useCallback } from 'react';
import { Badge } from '../types/study';
import { useUserProgress } from './useUserProgress';

// Badge definitions
const BADGE_DEFINITIONS: Badge[] = [
  {
    id: 'first-quiz',
    name: 'Quiz Starter',
    description: 'Completed your first exam question',
    icon: '🎯',
  },
  {
    id: 'streak-3',
    name: 'On a Roll',
    description: 'Maintained a 3-day study streak',
    icon: '🔥',
  },
  {
    id: 'streak-7',
    name: 'Week Warrior',
    description: 'Maintained a 7-day study streak',
    icon: '⚡',
  },
  {
    id: 'streak-30',
    name: 'Monthly Master',
    description: '30-day study streak — incredible!',
    icon: '🏆',
  },
  {
    id: 'xp-100',
    name: 'Century Club',
    description: 'Earned 100 XP',
    icon: '💯',
  },
  {
    id: 'xp-500',
    name: 'Knowledge Seeker',
    description: 'Earned 500 XP',
    icon: '📚',
  },
  {
    id: 'xp-1000',
    name: 'Scholar',
    description: 'Earned 1,000 XP',
    icon: '🎓',
  },
  {
    id: 'questions-10',
    name: 'Quiz Enthusiast',
    description: 'Answered 10 exam questions',
    icon: '✍️',
  },
  {
    id: 'questions-50',
    name: 'Exam Ready',
    description: 'Answered 50 exam questions',
    icon: '📝',
  },
  {
    id: 'questions-100',
    name: 'Question Master',
    description: 'Answered 100 exam questions',
    icon: '👑',
  },
];

export function useBadgeEarning() {
  const { progress, dailyStats, awardBadge } = useUserProgress();

  const checkAndAwardBadges = useCallback(() => {
    if (!progress) return;

    const earned = progress.badges || [];
    const earnedIds = new Set(earned.map(b => b.id));

    // Streak badges
    if (progress.streak >= 3 && !earnedIds.has('streak-3')) {
      awardBadge.mutate(BADGE_DEFINITIONS.find(b => b.id === 'streak-3')!);
    }
    if (progress.streak >= 7 && !earnedIds.has('streak-7')) {
      awardBadge.mutate(BADGE_DEFINITIONS.find(b => b.id === 'streak-7')!);
    }
    if (progress.streak >= 30 && !earnedIds.has('streak-30')) {
      awardBadge.mutate(BADGE_DEFINITIONS.find(b => b.id === 'streak-30')!);
    }

    // XP badges
    if (progress.xp >= 100 && !earnedIds.has('xp-100')) {
      awardBadge.mutate(BADGE_DEFINITIONS.find(b => b.id === 'xp-100')!);
    }
    if (progress.xp >= 500 && !earnedIds.has('xp-500')) {
      awardBadge.mutate(BADGE_DEFINITIONS.find(b => b.id === 'xp-500')!);
    }
    if (progress.xp >= 1000 && !earnedIds.has('xp-1000')) {
      awardBadge.mutate(BADGE_DEFINITIONS.find(b => b.id === 'xp-1000')!);
    }

    // Exam question badges (based on daily stats cumulative approximation)
    // We check examQuestionsToday > 0 as trigger for first-quiz
    if (dailyStats.examQuestionsToday >= 1 && !earnedIds.has('first-quiz')) {
      awardBadge.mutate(BADGE_DEFINITIONS.find(b => b.id === 'first-quiz')!);
    }
  }, [progress, dailyStats, awardBadge]);

  // Auto-check badges when progress changes
  useEffect(() => {
    checkAndAwardBadges();
  }, [progress?.xp, progress?.streak, dailyStats.examQuestionsToday]);

  return {
    allBadges: BADGE_DEFINITIONS,
    earnedBadges: progress?.badges || [],
    checkAndAwardBadges,
  };
}
