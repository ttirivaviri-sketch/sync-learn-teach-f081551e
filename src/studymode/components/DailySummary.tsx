import { useState, useCallback, useEffect } from 'react';
import { Trophy, Zap, Target, BookOpen, Flame, X, Sparkles, Loader2 } from 'lucide-react';
import { MathMarkdown } from './MathMarkdown';
import { Button } from '@/components/ui/button';
import { useUserProgress } from '../hooks/useUserProgress';
import { cn } from '@/lib/utils';
import { aiRequest } from '../lib/aiClient';
import { logger } from "@/utils/logger";

interface DailySummaryProps {
  onClose: () => void;
}

export function DailySummary({ onClose }: DailySummaryProps) {
  const { progress, dailyStats } = useUserProgress();
  const [aiMessage, setAiMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const stats = [
    {
      icon: Target,
      label: 'Tasks Completed',
      value: `${dailyStats.tasksCompletedToday}/${dailyStats.totalTasksToday || 0}`,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      icon: BookOpen,
      label: 'Exam Questions',
      value: dailyStats.examQuestionsToday.toString(),
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      icon: Zap,
      label: 'XP Earned Today',
      value: `+${dailyStats.xpToday}`,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      icon: Flame,
      label: 'Current Streak',
      value: `${progress?.streak || 0} days`,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  const totalXp = progress?.xp || 0;
  const badgeCount = progress?.badges?.length || 0;

  const generateSummaryMessage = useCallback(async () => {
    setIsGenerating(true);
    setAiMessage('');

    try {
      const resp = await aiRequest('daily-summary', {
            tasksCompleted: dailyStats.tasksCompletedToday,
            totalTasks: dailyStats.totalTasksToday,
            examQuestions: dailyStats.examQuestionsToday,
            xpToday: dailyStats.xpToday,
            streak: progress?.streak || 0,
            totalXp,
            badgeCount,
          });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate summary');
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setAiMessage(accumulated);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Flush remaining
      if (buffer.trim()) {
        for (const raw of buffer.split('\n')) {
          if (!raw || !raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setAiMessage(accumulated);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      logger.error('Daily summary AI error:', err);
      // Fallback to static message
      if (dailyStats.xpToday >= 100) setAiMessage("🔥 Outstanding session! You're crushing it!");
      else if (dailyStats.xpToday >= 50) setAiMessage("💪 Great work today! Keep the momentum going.");
      else if (dailyStats.xpToday > 0) setAiMessage("👍 Good start! Every bit of study counts.");
      else setAiMessage("📖 Ready to start studying? Open a subject to begin!");
    } finally {
      setIsGenerating(false);
    }
  }, [dailyStats, progress, totalXp, badgeCount]);

  // Auto-generate on mount
  useEffect(() => {
    generateSummaryMessage();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 p-6 rounded-2xl bg-card border border-border shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20">
              <Trophy className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Today's Summary</h2>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* AI Personalized Message */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20 mb-6">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs font-medium text-accent">AI Coach</span>
          </div>
          {isGenerating && !aiMessage ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Analyzing your session...</p>
            </div>
          ) : (
            <div className={cn(
              "prose prose-sm dark:prose-invert max-w-none [&_p]:text-sm [&_p]:mb-1 [&_p]:last:mb-0",
              isGenerating && "animate-pulse"
            )}>
              <MathMarkdown>{aiMessage}</MathMarkdown>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className={cn("p-4 rounded-xl border border-border", stat.bgColor)}>
              <stat.icon className={cn("h-5 w-5 mb-2", stat.color)} />
              <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border mb-6">
          <div className="text-center flex-1">
            <p className="text-lg font-bold text-foreground">{totalXp.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total XP</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center flex-1">
            <p className="text-lg font-bold text-foreground">{badgeCount}</p>
            <p className="text-xs text-muted-foreground">Badges</p>
          </div>
        </div>

        {/* Close */}
        <Button onClick={onClose} className="w-full gradient-primary">
          Continue Studying
        </Button>
      </div>
    </div>
  );
}
