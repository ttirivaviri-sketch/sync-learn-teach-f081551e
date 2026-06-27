import { Mail, ShieldCheck, AlertTriangle, CalendarDays } from 'lucide-react';
import { useGuardianOverview } from '../hooks/useGuardianOverview';

interface GuardianWorkspaceCardProps {
  userId?: string;
}

export function GuardianWorkspaceCard({ userId }: GuardianWorkspaceCardProps) {
  const {
    guardianEmail,
    latestReportWeek,
    latestReportSent,
    latestReportSentAt,
    openInterventionCount,
    highPriorityInterventionCount,
    isLoading,
  } = useGuardianOverview(userId);

  if (!userId) return null;

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">Guardian Workspace</h3>
          <p className="text-xs text-muted-foreground">Visibility into guardian reporting and student-support escalation.</p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
          LOS
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading guardian operations…</p>
      ) : guardianEmail ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Mail className="h-3.5 w-3.5 text-primary" />
              Guardian contact
            </div>
            <p className="text-sm text-foreground break-all">{guardianEmail}</p>
            <p className="text-xs text-muted-foreground">
              {latestReportSent
                ? `Latest weekly digest sent${latestReportSentAt ? ` on ${new Date(latestReportSentAt).toLocaleDateString()}` : ''}.`
                : 'Guardian digest is configured but no sent report is cached yet.'}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Support posture
            </div>
            <p className="text-sm text-foreground">
              {openInterventionCount} open intervention{openInterventionCount === 1 ? '' : 's'}
              {highPriorityInterventionCount > 0 ? ` · ${highPriorityInterventionCount} high priority` : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              Guardians can be brought into the loop when risk remains high or consistency drops.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5 sm:col-span-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <CalendarDays className="h-3.5 w-3.5 text-accent" />
              Weekly digest status
            </div>
            <p className="text-sm text-foreground">
              {latestReportWeek
                ? `Most recent guardian report week: ${new Date(latestReportWeek).toLocaleDateString()}`
                : 'No guardian digest cached yet.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Guardian reporting not configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add a guardian email in Academic Setup to activate weekly digests and parent-facing operational visibility.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
