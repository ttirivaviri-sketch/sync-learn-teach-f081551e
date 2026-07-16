/**
 * StudyPlanProposalsCard
 *
 * Student-facing surface for the LOS study-plan optimizer. Shows sessions
 * proposed by `run_study_plan_optimizer` (staged in
 * learning_ops_plan_proposals) and lets the learner accept — which writes a
 * real `study_schedule` entry and marks the proposal applied — or dismiss.
 * Renders nothing when there are no proposals.
 */
import { useState } from 'react';
import { CalendarCheck2, CalendarPlus, Loader2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { usePlanProposals } from '../hooks/usePlanProposals';
import { updatePlanProposalStatus, type PlanProposalSummary } from '../lib/learningOps';

interface StudyPlanProposalsCardProps {
  userId: string | null | undefined;
  className?: string;
}

function riskBadge(risk: number | null) {
  if (risk == null) return null;
  const pct = Math.round(risk * 100);
  const high = risk >= 0.7;
  return (
    <Badge
      variant={high ? 'destructive' : 'secondary'}
      className="text-[10px] shrink-0"
    >
      {pct}% risk
    </Badge>
  );
}

export function StudyPlanProposalsCard({ userId, className }: StudyPlanProposalsCardProps) {
  const { proposals, isLoading, refresh, dismiss, busyId } = usePlanProposals({
    userId: userId ?? null,
    status: 'proposed',
  });
  const { toast } = useToast();
  const [applyingId, setApplyingId] = useState<string | null>(null);

  if (!userId || isLoading || proposals.length === 0) return null;

  const applyProposal = async (proposal: PlanProposalSummary) => {
    setApplyingId(proposal.id);
    try {
      // 1. Materialize the session on the learner's real schedule.
      const { data: scheduleRow, error: scheduleError } = await supabase
        .from('study_schedule')
        .insert({
          user_id: userId,
          subject: proposal.subjectName,
          topic_name: proposal.topicName,
          task: `Focus session: ${proposal.topicName}`,
          task_type: 'focus',
          scheduled_date: proposal.proposedFor,
          duration_minutes: proposal.durationMinutes,
          notes: proposal.reason,
          is_completed: false,
        })
        .select('id')
        .single();
      if (scheduleError) throw scheduleError;

      // 2. Mark the proposal applied (best-effort — schedule row is created).
      await updatePlanProposalStatus({ proposalId: proposal.id, status: 'applied' });

      toast({
        title: 'Added to your plan',
        description: `${proposal.topicName} · ${proposal.durationMinutes} min on ${new Date(proposal.proposedFor).toLocaleDateString()}`,
      });
      void scheduleRow;
      await refresh();
    } catch (err) {
      toast({
        title: 'Could not add session',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div
      className={cn(
        'rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 space-y-3 animate-fade-in',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Suggested study sessions</h3>
        <Badge variant="secondary" className="text-[10px]">
          {proposals.length}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        The optimizer flagged these topics based on your recent mastery trends.
      </p>

      <div className="space-y-2">
        {proposals.slice(0, 3).map((proposal) => {
          const busy = applyingId === proposal.id || busyId === proposal.id;
          return (
            <div
              key={proposal.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <CalendarCheck2 className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {proposal.topicName}
                  </p>
                  {riskBadge(proposal.projectedRisk)}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {proposal.subjectName} · {proposal.durationMinutes} min ·{' '}
                  {new Date(proposal.proposedFor).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={busy}
                  onClick={() => applyProposal(proposal)}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </>
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  disabled={busy}
                  onClick={() => dismiss(proposal.id)}
                  aria-label="Dismiss suggestion"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
