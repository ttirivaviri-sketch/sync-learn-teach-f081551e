// @ts-nocheck — LOS bundle targets hand-typed contract for tables not yet in generated types; see MANUAL_EDITS.md
/**
 * TeacherClassDetail
 *
 * Phase 3.2 component. Class-scoped counterpart to the Teacher Command Center.
 * Surfaces:
 *   - the class' at-risk roster (projected risk + open interventions)
 *   - actions: route interventions to teachers, run study plan optimizer
 *   - plan proposals for members of the class
 */
import { useMemo } from 'react';
import { AlertTriangle, Compass, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useClassAtRisk } from '../hooks/useClassAtRisk';
import { usePlanProposals } from '../hooks/usePlanProposals';

interface Props {
  workspaceId: string;
  cohortId: string;
  cohortName: string;
  canManage: boolean;
}

function riskClass(risk: number) {
  if (risk >= 75) return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (risk >= 55) return 'border-warning/30 bg-warning/10 text-warning';
  return 'border-success/30 bg-success/10 text-success';
}

export function TeacherClassDetail({ workspaceId, cohortId, cohortName, canManage }: Props) {
  const { rows, isLoading, busy, refresh, routeToTeachers, runOptimizer } = useClassAtRisk({ workspaceId, cohortId });
  const { proposals, isLoading: proposalsLoading, refresh: refreshProposals, accept, dismiss, busyId } = usePlanProposals({ workspaceId, status: 'proposed' });
  const { toast } = useToast();

  const scopedProposals = useMemo(() => {
    const inClass = new Set(rows.map((row) => row.userId));
    return proposals.filter((proposal) => inClass.has(proposal.userId));
  }, [proposals, rows]);

  const totalHighRisk = rows.filter((row) => row.projectedRisk >= 65).length;
  const totalOpen = rows.reduce((acc, row) => acc + row.openCount, 0);
  const totalHigh = rows.reduce((acc, row) => acc + row.highCount, 0);

  const handleRoute = async () => {
    const routed = await routeToTeachers();
    toast({ title: 'Interventions routed', description: `${routed} intervention${routed === 1 ? '' : 's'} assigned to cohort leads.` });
  };

  const handleOptimize = async () => {
    const result = (await runOptimizer()) as { proposals_created?: number } | null;
    await refreshProposals();
    toast({
      title: 'Study plan optimizer complete',
      description: `${result?.proposals_created ?? 0} new proposal${result?.proposals_created === 1 ? '' : 's'} staged for tomorrow.`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">{cohortName}</h2>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-accent/15 text-accent border border-accent/30 uppercase">
                Class detail
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Class-scoped LOS surface: risk, interventions, and proposed plan changes.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Users className="h-3.5 w-3.5 text-primary" />
              Students
            </div>
            <p className="text-2xl font-bold text-foreground">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              Open interventions
            </div>
            <p className="text-2xl font-bold text-foreground">{totalOpen}</p>
            <p className="text-[11px] text-muted-foreground">{totalHigh} high priority</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
              High projected risk (≥65)
            </div>
            <p className="text-2xl font-bold text-foreground">{totalHighRisk}</p>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy !== null} onClick={handleRoute}>
              {busy === 'route' ? 'Routing…' : 'Route open interventions to teachers'}
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={handleOptimize}>
              {busy === 'optimize' ? 'Optimising…' : 'Run study plan optimizer'}
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Roster (projected risk)</h3>
          <span className="text-[11px] text-muted-foreground">{rows.length} member{rows.length === 1 ? '' : 's'}</span>
        </div>
        {rows.length === 0 && !isLoading && (
          <p className="text-xs text-muted-foreground">No members yet, or no learning evidence to project risk.</p>
        )}
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.userId} className="rounded-xl border border-border bg-background/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Learner {row.userId.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.openCount} open · {row.highCount} high priority
                    {row.lastAlertAt ? ` · last alert ${new Date(row.lastAlertAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full border uppercase', riskClass(row.projectedRisk))}>
                  risk {row.projectedRisk}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Plan proposals</h3>
          <Button size="sm" variant="outline" onClick={refreshProposals} disabled={proposalsLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        {scopedProposals.length === 0 && (
          <p className="text-xs text-muted-foreground">No open proposals for this class. Run the optimizer to generate some.</p>
        )}
        <div className="space-y-2">
          {scopedProposals.slice(0, 12).map((proposal) => {
            const isBusy = busyId === proposal.id;
            return (
              <div key={proposal.id} className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{proposal.subjectName} · {proposal.topicName}</p>
                    <p className="text-xs text-muted-foreground">
                      Learner {proposal.userId.slice(0, 8)} · {proposal.durationMinutes}m · {proposal.reason}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Proposed for {new Date(proposal.proposedFor).toLocaleDateString()}</p>
                  </div>
                  {proposal.projectedRisk !== null && (
                    <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full border uppercase', riskClass(proposal.projectedRisk))}>
                      risk {proposal.projectedRisk}
                    </span>
                  )}
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={isBusy} onClick={() => accept(proposal.id)}>Accept</Button>
                    <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => dismiss(proposal.id)}>Dismiss</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}