import { useState, useEffect, useCallback } from 'react';
import { Flame, X, Sparkles, Loader2, PartyPopper } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { useUserProgress } from '../hooks/useUserProgress';
import { aiRequestJSON } from '../lib/aiClient';

const MILESTONES = [7, 14, 30];
const STORAGE_KEY = 'celebrated-streaks';

function getCelebratedStreaks(): number[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function markCelebrated(milestone: number) {
  const celebrated = getCelebratedStreaks();
  if (!celebrated.includes(milestone)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...celebrated, milestone]));
  }
}

const milestoneEmoji: Record<number, string> = {
  7: '⚡',
  14: '🔥',
  30: '🏆',
};

const milestoneTitle: Record<number, string> = {
  7: '1 Week Streak!',
  14: '2 Week Streak!',
  30: 'Monthly Master!',
};

export function StreakCelebration() {
  const { progress, dailyStats } = useUserProgress();
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);
  const [aiMessage, setAiMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  // Check if a new milestone was reached
  useEffect(() => {
    if (!progress) return;
    const streak = progress.streak || 0;
    const celebrated = getCelebratedStreaks();

    for (const m of MILESTONES) {
      if (streak >= m && !celebrated.includes(m)) {
        setActiveMilestone(m);
        setVisible(true);
        break;
      }
    }
  }, [progress?.streak]);

  // Generate AI message when milestone activates
  const generateMessage = useCallback(async (milestone: number) => {
    setIsLoading(true);
    try {
      const data = await aiRequestJSON<{ message?: string }>('streak-celebration', {
            milestone,
            streak: progress?.streak || milestone,
            totalXp: progress?.xp || 0,
            badgeCount: progress?.badges?.length || 0,
            tasksCompletedToday: dailyStats.tasksCompletedToday,
          });
      setAiMessage(data.message || '');
    } catch (err) {
      console.error('Streak celebration error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [progress, dailyStats]);

  useEffect(() => {
    if (activeMilestone && visible) {
      generateMessage(activeMilestone);
    }
  }, [activeMilestone, visible]);

  const handleClose = () => {
    if (activeMilestone) markCelebrated(activeMilestone);
    setVisible(false);
    setActiveMilestone(null);
    setAiMessage('');
  };

  if (!visible || !activeMilestone) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm mx-4 p-6 rounded-2xl bg-card border border-border shadow-2xl animate-scale-in relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 bg-gradient-to-br from-warning/10 via-accent/5 to-primary/10 pointer-events-none" />

        <div className="relative">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute -top-2 -right-2 h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Celebration icon */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-warning/20 mb-3">
              <span className="text-4xl">{milestoneEmoji[activeMilestone]}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <PartyPopper className="h-5 w-5 text-warning" />
              <h2 className="text-xl font-bold text-foreground">
                {milestoneTitle[activeMilestone]}
              </h2>
              <PartyPopper className="h-5 w-5 text-warning scale-x-[-1]" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {activeMilestone} days of consistent studying
            </p>
          </div>

          {/* Streak flame visual */}
          <div className="flex items-center justify-center gap-1 mb-4">
            {Array.from({ length: Math.min(activeMilestone, 7) }).map((_, i) => (
              <Flame
                key={i}
                className={cn(
                  "text-warning",
                  i < 3 ? "h-6 w-6" : i < 5 ? "h-5 w-5" : "h-4 w-4",
                  "animate-pulse"
                )}
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>

          {/* AI personalized message */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-accent/10 to-warning/10 border border-accent/20 mb-5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-medium text-accent">AI Coach</span>
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Crafting your celebration...</p>
              </div>
            ) : aiMessage ? (
              <p className="text-sm text-foreground leading-relaxed">{aiMessage}</p>
            ) : (
              <p className="text-sm text-foreground">
                Amazing dedication! {activeMilestone} days of consistent study puts you ahead of most students. Keep it up! 🌟
              </p>
            )}
          </div>

          {/* Action */}
          <Button onClick={handleClose} className="w-full gradient-primary">
            Keep the Streak Going! 🔥
          </Button>
        </div>
      </div>
    </div>
  );
}
