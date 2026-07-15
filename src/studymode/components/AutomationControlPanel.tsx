/**
 * AutomationControlPanel
 *
 * Phase 3.1 UI. Sits inside the Teacher Command Center and lets staff view
 * the automation schedule, change cadence, toggle jobs on/off, and manually
 * trigger a job (nightly sweep, weekly rollup, guardian digest).
 */
import { Bot, PlayCircle, RefreshCw } from 'lucide-react';
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
import { useAutomationRuntime } from '../hooks/useAutomationRuntime';
import type { AutomationJobName, AutomationCadence } from '../lib/learningOps';

const JOB_LABELS: Record<AutomationJobName, { label: string; description: string }> = {
  nightly_intervention_sweep: {
    label: 'Nightly intervention sweep',
    description: 'Auto-resolves stale open interventions with no post-evidence and refreshes queue counts.',
  },
  weekly_cohort_rollup: {
    label: 'Weekly cohort rollup',
    description: 'Aggregates cohort-level intervention pressure and 7-day mastery delta into automation runs.',
  },
  guardian_digest: {
    label: 'Guardian digest',
    description: 'Delegates to the guardian report edge function and logs the run for cadence visibility.',
  },
  concept_ingestion: {
    label: 'Concept ingestion',
    description: 'Managed from the School Admin Console — documents move through review before promotion.',
  },
  study_plan_optimizer: {
    label: 'Study plan optimizer',
    description: 'Nightly: proposes new schedule slots based on projected risk and open interventions.',
  },
  route_interventions_to_teachers: {
    label: 'Per-teacher alert routing',
    description: 'Assigns open intervention queue rows to the cohort lead teacher responsible for the learner.',
  },
};

const DEFAULT_JOBS: AutomationJobName[] = [
  'nightly_intervention_sweep',
  'weekly_cohort_rollup',
  'guardian_digest',
  'study_plan_optimizer',
  'route_interventions_to_teachers',
];

function statusClass(status: 'succeeded' | 'failed' | 'partial' | null) {
  if (status === 'failed') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (status === 'partial') return 'border-warning/30 bg-warning/10 text-warning';
  if (status === 'succeeded') return 'border-success/30 bg-success/10 text-success';
  return 'border-border bg-muted text-muted-foreground';
}

interface Props {
  workspaceId: string | null;
  canManage: boolean;
}

export function AutomationControlPanel({ workspaceId, canManage }: Props) {
  const { schedule, isLoading, busyJob, lastResult, refresh, setCadence, toggleEnabled, runJob } = useAutomationRuntime({ workspaceId });
  const { toast } = useToast();

  if (!workspaceId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-accent-foreground" />
          <h3 className="text-sm font-bold text-foreground">Automation control</h3>
        </div>
        <p className="text-sm text-muted-foreground">Connect a workspace first to configure LOS automation.</p>
      </div>
    );
  }

  const scheduleByJob = new Map(schedule.map((row) => [row.jobName, row]));

  const handleRun = async (jobName: AutomationJobName) => {
    await runJob(jobName);
    toast({ title: `${JOB_LABELS[jobName].label} triggered`, description: 'Cadence log will refresh shortly.' });
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-accent-foreground" />
            <h3 className="text-sm font-bold text-foreground">Automation control</h3>
          </div>
          <p className="text-xs text-muted-foreground">Schedule, run, and audit LOS jobs for this workspace.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {lastResult && (
        <div className={cn('rounded-lg border p-2 text-xs', statusClass(lastResult.status === 'skipped' ? null : lastResult.status))}>
          Last run · {JOB_LABELS[lastResult.jobName]?.label ?? lastResult.jobName} · {lastResult.status}
          {lastResult.rowsProcessed ? ` · ${lastResult.rowsProcessed} rows` : ''}
          {lastResult.error ? ` · ${lastResult.error}` : ''}
        </div>
      )}

      <div className="space-y-2">
        {DEFAULT_JOBS.map((jobName) => {
          const meta = JOB_LABELS[jobName];
          const row = scheduleByJob.get(jobName);
          const isBusy = busyJob === jobName;
          return (
            <div key={jobName} className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
                <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full border uppercase', statusClass(row?.lastStatus ?? null))}>
                  {row?.lastStatus ?? 'not run'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-muted-foreground">
                  {row?.enabled === false ? 'Disabled' : `Cadence: ${row?.cadence ?? 'daily'}`}
                  {row?.lastRunAt ? ` · last ${new Date(row.lastRunAt).toLocaleString()}` : ''}
                </div>
                {canManage && (
                  <>
                    <Select
                      value={row?.cadence ?? 'daily'}
                      onValueChange={(value) => setCadence(jobName, value as AutomationCadence)}
                    >
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue placeholder="Cadence" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant={row?.enabled === false ? 'outline' : 'ghost'}
                      disabled={isBusy}
                      onClick={() => toggleEnabled(jobName, !(row?.enabled ?? true))}
                    >
                      {row?.enabled === false ? 'Enable' : 'Disable'}
                    </Button>
                    <Button size="sm" disabled={isBusy} onClick={() => handleRun(jobName)}>
                      <PlayCircle className="mr-2 h-4 w-4" />
                      {isBusy ? 'Running…' : 'Run now'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}