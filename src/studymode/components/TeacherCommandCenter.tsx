// @ts-nocheck — LOS bundle targets hand-typed contract for tables not yet in generated types; see MANUAL_EDITS.md
/**
 * TeacherCommandCenter
 *
 * Workspace-level operational dashboard for teachers, admins, and owners.
 *
 * Surfaces:
 * - Headline KPIs (students, open interventions, high-priority count)
 * - Intervention outcome telemetry and automation cadence visibility
 * - Students at risk (sorted by open interventions and mastery delta)
 * - Cohort rollups (interventions and average mastery delta per cohort)
 * - Open intervention queue (with acknowledge / resolve / dismiss / reassign actions)
 * - Recent intervention events feed for transparency
 */
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Radar,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TimerReset,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTeacherCommandCenter } from '../hooks/useTeacherCommandCenter';
import type { WorkspaceRole } from '../lib/learningOps';
import { AutomationControlPanel } from './AutomationControlPanel';

function severityClass(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (priority === 'medium') return 'border-warning/30 bg-warning/10 text-warning';
  return 'border-accent/30 bg-accent/10 text-accent';
}

function formatRelative(dateLike: string | null) {
  if (!dateLike) return 'No activity yet';
  const ts = new Date(dateLike).getTime();
  if (Number.isNaN(ts)) return 'No activity yet';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function formatCompactDate(dateLike: string | null) {
  if (!dateLike) return '—';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

export function TeacherCommandCenter() {
  const {
    snapshot,
    role,
    isLoading,
    error,
    refresh,
    workspaceId,
    acknowledgeIntervention,
    resolveIntervention,
    dismissIntervention,
    reassignIntervention,
  } = useTeacherCommandCenter();
  const canManageAutomation = role === 'owner' || role === 'admin' || role === 'teacher';
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cohortFilter, setCohortFilter] = useState<string>('all');

  const cohortOptions = useMemo(() => {
    if (!snapshot) return [] as string[];
    return Array.from(new Set(snapshot.cohortRollups.map((cohort) => cohort.cohortName)));
  }, [snapshot]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-accent" />
        <p className="text-sm text-muted-foreground">Loading Teacher Command Center…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 rounded-2xl border border-destructive/30 bg-destructive/10 text-sm text-destructive">
        Failed to load Teacher Command Center: {error}
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="p-5 rounded-2xl border border-border bg-card space-y-2">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-accent" />
          <h3 className="font-bold text-foreground">Teacher Command Center</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          You are not connected to a school workspace as a teacher, admin, or owner yet.
        </p>
        <p className="text-xs text-muted-foreground">
          Ask a workspace owner to invite you as a teacher to activate this dashboard, or create your own workspace from the Learning Mission Control.
        </p>
      </div>
    );
  }

  const filteredStudents = cohortFilter === 'all'
    ? snapshot.studentsAtRisk
    : snapshot.studentsAtRisk.filter((student) => student.cohortNames.includes(cohortFilter));

  const filteredInterventions = cohortFilter === 'all'
    ? snapshot.openInterventions
    : snapshot.openInterventions.filter((row) => {
        const student = snapshot.studentsAtRisk.find((s) => s.userId === row.studentUserId);
        return student?.cohortNames.includes(cohortFilter);
      });

  const runAction = async (
    action: () => Promise<void>,
    interventionId: string,
    successTitle: string,
  ) => {
    setBusyId(interventionId);
    try {
      await action();
      toast({ title: successTitle });
    } catch (err) {
      toast({
        title: 'Action failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Radar className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">Teacher Command Center</h2>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-accent/15 text-accent border border-accent/30 uppercase">
                {role ?? 'staff'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {snapshot.workspaceName} · operational view of students, cohorts, intervention outcomes, and automation cadence.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Users className="h-3.5 w-3.5 text-primary" />
              Students
            </div>
            <p className="text-2xl font-bold text-foreground">{snapshot.totalStudents}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <ClipboardList className="h-3.5 w-3.5 text-accent" />
              Open queue
            </div>
            <p className="text-2xl font-bold text-foreground">{snapshot.totalOpenInterventions}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <ShieldAlert className="h-3.5 w-3.5 text-warning" />
              High priority
            </div>
            <p className="text-2xl font-bold text-foreground">{snapshot.totalHighPriorityInterventions}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              Resolved outcomes
            </div>
            <p className="text-2xl font-bold text-foreground">{snapshot.interventionOutcomeSummary.resolvedCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <TimerReset className="h-3.5 w-3.5 text-primary" />
              Avg. hours open
            </div>
            <p className="text-2xl font-bold text-foreground">{snapshot.interventionOutcomeSummary.averageHoursOpen}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-success" />
              Post-action Δ
            </div>
            <p className={cn('text-2xl font-bold', snapshot.interventionOutcomeSummary.totalPostScoreDelta >= 0 ? 'text-success' : 'text-warning')}>
              {snapshot.interventionOutcomeSummary.totalPostScoreDelta > 0 ? '+' : ''}{snapshot.interventionOutcomeSummary.totalPostScoreDelta}
            </p>
          </div>
        </div>

        {cohortOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filter by cohort:</span>
            <Select value={cohortFilter} onValueChange={setCohortFilter}>
              <SelectTrigger className="w-[220px] h-8 text-xs">
                <SelectValue placeholder="All cohorts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cohorts</SelectItem>
                {cohortOptions.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <AutomationControlPanel workspaceId={workspaceId} canManage={canManageAutomation} />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Automation cadence</h3>
            <p className="text-xs text-muted-foreground">
              Visibility into nightly recomputations, rollups, and digest jobs for this workspace.
            </p>
          </div>
          {snapshot.automationRuns.length > 0 ? (
            <div className="space-y-2">
              {snapshot.automationRuns.map((run) => (
                <div key={run.id} className="rounded-xl border border-border bg-background/60 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-accent" />
                      <p className="text-sm font-semibold text-foreground capitalize">{run.jobName.replace(/_/g, ' ')}</p>
                    </div>
                    <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full border uppercase', run.status === 'failed' ? 'border-destructive/30 bg-destructive/10 text-destructive' : run.status === 'partial' ? 'border-warning/30 bg-warning/10 text-warning' : 'border-success/30 bg-success/10 text-success')}>
                      {run.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Started {formatCompactDate(run.startedAt)} · {run.rowsProcessed} row{run.rowsProcessed === 1 ? '' : 's'} processed
                  </p>
                  {run.errorMessage && <p className="text-xs text-destructive">{run.errorMessage}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No automation runs have been logged for this workspace yet.</p>
          )}
        </div>

        <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Concept momentum</h3>
            <p className="text-xs text-muted-foreground">
              Strongest concept movement across the workspace based on recent mastery evidence.
            </p>
          </div>
          {snapshot.conceptTrendLeaders.length > 0 ? (
            <div className="space-y-2">
              {snapshot.conceptTrendLeaders.map((trend) => (
                <div key={`${trend.subjectName}-${trend.topicName}-${trend.conceptName}`} className="rounded-xl border border-border bg-background/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{trend.conceptName}</p>
                      <p className="text-xs text-muted-foreground">{trend.subjectName} · {trend.topicName}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-semibold', trend.totalScoreDelta >= 0 ? 'text-success' : 'text-warning')}>
                        {trend.totalScoreDelta > 0 ? '+' : ''}{trend.totalScoreDelta}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{trend.evidenceCount} evidence</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Avg confidence {trend.avgConfidence}%</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Concept trends will appear once mastery evidence accumulates across students.</p>
          )}
        </div>
      </div>

      {snapshot.cohortRollups.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Cohort rollups</h3>
            <p className="text-xs text-muted-foreground">
              Aggregated intervention pressure and mastery momentum per cohort.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {snapshot.cohortRollups.map((cohort) => (
              <div key={cohort.cohortId} className="rounded-xl border border-border bg-background/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{cohort.cohortName}</p>
                  <span className="text-[11px] text-muted-foreground">{cohort.studentCount} student{cohort.studentCount === 1 ? '' : 's'}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Open</p>
                    <p className="font-semibold text-foreground">{cohort.openInterventionCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">High pri</p>
                    <p className="font-semibold text-foreground">{cohort.highPriorityInterventionCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mastery Δ</p>
                    <p className={cn('font-semibold', cohort.averageMasteryScoreDelta >= 0 ? 'text-success' : 'text-warning')}>
                      {cohort.averageMasteryScoreDelta > 0 ? '+' : ''}{cohort.averageMasteryScoreDelta}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Students at risk</h3>
            <p className="text-xs text-muted-foreground">
              Sorted by open intervention pressure, then mastery momentum.
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground">{filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'}</span>
        </div>

        {filteredStudents.length > 0 ? (
          <div className="space-y-2">
            {filteredStudents.slice(0, 12).map((student) => (
              <div key={student.userId} className="rounded-xl border border-border bg-background/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{student.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {student.cohortNames.length > 0 ? student.cohortNames.join(', ') : 'No cohort assigned'} · last evidence {formatRelative(student.lastEvidenceAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-sm font-semibold', student.highPriorityInterventionCount > 0 ? 'text-destructive' : 'text-foreground')}>
                      {student.openInterventionCount} open
                    </p>
                    {student.highPriorityInterventionCount > 0 && (
                      <p className="text-[11px] text-destructive">{student.highPriorityInterventionCount} high priority</p>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Mastery delta (recent): {student.recentMasteryScoreDelta > 0 ? '+' : ''}{student.recentMasteryScoreDelta}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-success/30 bg-success/10 p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
            <p className="text-sm text-foreground">No at-risk learners in this cohort filter.</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Open intervention queue
          </div>
          <span className="text-[11px] text-muted-foreground">{filteredInterventions.length} active</span>
        </div>

        {filteredInterventions.length > 0 ? (
          <div className="space-y-2">
            {filteredInterventions.slice(0, 10).map((row) => {
              const isBusy = busyId === row.id;
              return (
                <div key={row.id} className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground capitalize">
                        {row.interventionType.replace(/-/g, ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.studentName} · {formatRelative(row.createdAt)} · status {row.status}</p>
                      <p className="text-sm text-foreground mt-1">{row.reason}</p>
                    </div>
                    <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full border uppercase', severityClass(row.priority))}>
                      {row.priority}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy || row.status === 'acknowledged'}
                      onClick={() => runAction(() => acknowledgeIntervention(row.id), row.id, 'Intervention acknowledged')}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => runAction(() => resolveIntervention(row.id), row.id, 'Intervention resolved')}
                    >
                      Resolve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => runAction(() => dismissIntervention(row.id), row.id, 'Intervention dismissed')}
                    >
                      Dismiss
                    </Button>
                    <Select
                      onValueChange={(value) =>
                        runAction(() => reassignIntervention(row.id, value as WorkspaceRole), row.id, `Reassigned to ${value}`)
                      }
                    >
                      <SelectTrigger className="w-[170px] h-8 text-xs">
                        <SelectValue placeholder="Reassign to…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="tutor">Tutor</SelectItem>
                        <SelectItem value="guardian">Guardian</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-success/30 bg-success/10 p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
            <p className="text-sm text-foreground">No open interventions in this filter — the queue is clear.</p>
          </div>
        )}
      </div>

      {snapshot.recentInterventionEvents.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Recent intervention activity</h3>
            <p className="text-xs text-muted-foreground">Transparency log of acknowledgements, resolutions, and reassignments.</p>
          </div>
          <div className="space-y-2">
            {snapshot.recentInterventionEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-border bg-background/60 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-accent mt-0.5" />
                  <div>
                    <p className="text-foreground capitalize font-medium">{event.actionType.replace(/-/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">{formatRelative(event.createdAt)}</p>
                    {event.note && <p className="text-sm text-foreground mt-1">{event.note}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}