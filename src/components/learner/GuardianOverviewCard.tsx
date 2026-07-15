/**
 * GuardianOverviewCard — live guardian-facing summary for a learner.
 *
 * Mounts the previously-dormant `useGuardianOverview` hook: shows the
 * configured guardian email, latest weekly report status, and open
 * intervention counts from the Learning OS queue. Renders nothing when the
 * learner has no guardian email configured (no visual noise).
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, HeartHandshake, MailCheck, MailX } from "lucide-react";
import { useGuardianOverview } from "@/studymode/hooks/useGuardianOverview";

export function GuardianOverviewCard({ userId }: { userId: string }) {
  const overview = useGuardianOverview(userId);
  const { isLoading } = overview;

  if (isLoading) {
    return (
      <Card className="border-rose-500/25 bg-rose-500/[0.04]">
        <CardContent className="p-4">
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardContent>
      </Card>
    );
  }

  // Nothing configured — stay quiet.
  if (!overview.guardianEmail) return null;

  const reportLabel = overview.latestReportWeek
    ? `Week of ${new Date(overview.latestReportWeek).toLocaleDateString()}`
    : "No report yet";

  return (
    <Card className="border-rose-500/25 bg-rose-500/[0.04]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
            <HeartHandshake className="h-5 w-5 text-rose-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">Guardian updates</p>
            <p className="text-xs text-muted-foreground truncate">
              Weekly reports go to {overview.guardianEmail}
            </p>
          </div>
          {overview.highPriorityInterventionCount > 0 && (
            <Badge variant="destructive" className="text-[10px] gap-1">
              <AlertTriangle className="h-3 w-3" />
              {overview.highPriorityInterventionCount} urgent
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
            {overview.latestReportSent ? (
              <MailCheck className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <MailX className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {reportLabel}
            {overview.latestReportSent && overview.latestReportSentAt && (
              <span className="text-muted-foreground">
                · sent {new Date(overview.latestReportSentAt).toLocaleDateString()}
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
            {overview.openInterventionCount === 0
              ? "No open support flags"
              : `${overview.openInterventionCount} open support ${overview.openInterventionCount === 1 ? "flag" : "flags"}`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
