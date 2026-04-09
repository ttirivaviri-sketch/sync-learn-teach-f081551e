/**
 * AdaptivePlanBanner
 *
 * Displays the current AI study-plan status on the Dashboard.
 * Shows:
 *  - When was the last plan generated
 *  - Current completion rate
 *  - A "Regenerate Plan" button (manual trigger)
 *  - Auto-shows when plan is overdue or 70%+ complete
 */

import { useState, useEffect } from 'react';
import { Brain, RefreshCw, Loader2, TrendingUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAdaptiveLearningEngine } from '../hooks/useAdaptiveLearningEngine';
import { supabase } from '../../integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function AdaptivePlanBanner() {
  const {
    isGeneratingPlan,
    lastPlanGenerated,
    performanceSummary,
    error,
    generateStudyPlan,
    refreshPerformance,
  } = useAdaptiveLearningEngine();

  const [scheduleCount, setScheduleCount] = useState<number | null>(null);
  const [completedCount, setCompletedCount] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Load current month schedule stats
  useEffect(() => {
    const loadStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.substring(0, 7) + '-01';

      const { data } = await supabase
        .from('study_schedule')
        .select('is_completed')
        .eq('user_id', user.id)
        .gte('scheduled_date', monthStart)
        .lte('scheduled_date', today);

      if (data) {
        setScheduleCount(data.length);
        setCompletedCount(data.filter((r: any) => r.is_completed).length);
      }
    };

    loadStats();
    // Also refresh performance summary
    refreshPerformance().catch(() => {});
  }, [refreshPerformance]);

  const completionRate =
    scheduleCount && scheduleCount > 0
      ? (completedCount || 0) / scheduleCount
      : performanceSummary?.completionRate || 0;

  const lastGenStr = localStorage.getItem('lastPlanGenerated');
  const lastGenDate = lastGenStr ? parseISO(lastGenStr) : lastPlanGenerated;
  const planIsStale =
    !lastGenDate ||
    (Date.now() - lastGenDate.getTime()) / (1000 * 3600 * 24) > 7; // older than 7 days

  const planNeedsUpdate = completionRate >= 0.7;

  // Only show banner if there's something meaningful to display
  const shouldShow =
    scheduleCount !== null &&
    (scheduleCount === 0 || planIsStale || planNeedsUpdate || error);

  const handleGenerate = async (mode: 'initial' | 'adaptive' = 'adaptive') => {
    try {
      await generateStudyPlan(mode);
      setShowSuccess(true);
      // Reload stats
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const today = new Date().toISOString().split('T')[0];
        const monthStart = today.substring(0, 7) + '-01';
        const { data } = await supabase
          .from('study_schedule')
          .select('is_completed')
          .eq('user_id', user.id)
          .gte('scheduled_date', monthStart)
          .lte('scheduled_date', today);
        if (data) {
          setScheduleCount(data.length);
          setCompletedCount(data.filter((r: any) => r.is_completed).length);
        }
      }
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (_err) {
      // error is already in state from the hook
    }
  };

  if (!shouldShow && !isGeneratingPlan) return null;

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 space-y-3 animate-fade-in',
        planNeedsUpdate
          ? 'bg-accent/10 border-accent/30'
          : planIsStale
          ? 'bg-yellow-500/10 border-yellow-500/30'
          : error
          ? 'bg-destructive/10 border-destructive/30'
          : 'bg-muted/40 border-border'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            'p-1.5 rounded-lg',
            planNeedsUpdate ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'
          )}>
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {scheduleCount === 0
                ? 'No Study Plan Yet'
                : planNeedsUpdate
                ? '🎉 Great progress! Time to adapt your plan'
                : planIsStale
                ? 'Your study plan may be outdated'
                : 'AI Study Plan'}
            </p>
            <p className="text-xs text-muted-foreground">
              {lastGenDate
                ? `Last generated ${formatDistanceToNow(lastGenDate, { addSuffix: true })}`
                : 'Generate your first AI-powered study plan'}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant={planNeedsUpdate ? 'default' : 'outline'}
          className={cn('gap-1.5 shrink-0', planNeedsUpdate && 'gradient-primary')}
          onClick={() => handleGenerate(scheduleCount === 0 ? 'initial' : 'adaptive')}
          disabled={isGeneratingPlan}
        >
          {isGeneratingPlan ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
          ) : (
            <><RefreshCw className="h-3.5 w-3.5" /> {scheduleCount === 0 ? 'Generate Plan' : 'Regenerate'}</>
          )}
        </Button>
      </div>

      {/* Completion progress */}
      {scheduleCount !== null && scheduleCount > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              This month's progress
            </span>
            <span className={cn(
              'font-semibold',
              completionRate >= 0.7 ? 'text-success' : completionRate >= 0.4 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'
            )}>
              {completedCount}/{scheduleCount} tasks ({Math.round(completionRate * 100)}%)
            </span>
          </div>
          <Progress
            value={completionRate * 100}
            className={cn(
              'h-1.5',
              completionRate >= 0.7 ? '[&>div]:bg-success' : completionRate >= 0.4 ? '[&>div]:bg-yellow-500' : ''
            )}
          />
        </div>
      )}

      {/* Performance weak areas */}
      {performanceSummary?.weakTopics && performanceSummary.weakTopics.length > 0 && (
        <div className="flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Weak areas: </span>
            {performanceSummary.weakTopics.slice(0, 4).join(' · ')}
            {performanceSummary.weakTopics.length > 4 && ` +${performanceSummary.weakTopics.length - 4} more`}
          </p>
        </div>
      )}

      {/* Success flash */}
      {showSuccess && (
        <div className="flex items-center gap-2 text-xs text-success bg-success/10 rounded-lg px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Study plan generated and saved to your calendar!
        </div>
      )}

      {/* Error */}
      {error && !isGeneratingPlan && (
        <p className="text-xs text-destructive">⚠ {error}</p>
      )}
    </div>
  );
}
