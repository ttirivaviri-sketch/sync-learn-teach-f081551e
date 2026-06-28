/**
 * RemediationTrackerPanel — shows every is_remediation homework assigned
 * in the school with generated → released → completed status so admins can
 * see the impact of kernel-driven interventions over time.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck } from "lucide-react";
import { useRemediationTracker } from "@/hooks/useRemediationTracker";
import { Link } from "react-router-dom";

export function RemediationTrackerPanel({ schoolId }: { schoolId: string }) {
  const q = useRemediationTracker(schoolId);
  const rows = q.data ?? [];

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Remediation tracker</h3>
          <Badge variant="outline" className="ml-auto text-[10px]">{rows.length} interventions</Badge>
        </div>

        {q.isLoading && <Skeleton className="h-20 w-full" />}

        {!q.isLoading && rows.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No remediation homework yet. Use the "Assign" buttons on at-risk topics to generate one — they'll appear here so you can track release and completion.
          </p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Topic / Title</th>
                  <th className="text-left px-3 py-2">Class</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Completion</th>
                  <th className="text-right px-3 py-2">Avg score</th>
                  <th className="text-left px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pct = r.enrolled > 0 ? Math.round((r.responses / r.enrolled) * 100) : 0;
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium truncate max-w-[220px]">{r.title}</div>
                        {r.remediation_topic && <div className="text-[11px] text-muted-foreground truncate">{r.remediation_topic}</div>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.class_id ? (
                          <Link to={`/school/${schoolId}/classes/${r.class_id}?tab=homework`} className="hover:underline">
                            {r.class_name ?? "—"}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={r.status === "published" ? "default" : "secondary"} className="text-[10px]">
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.responses}/{r.enrolled} <span className="text-muted-foreground">({pct}%)</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.avgScorePct != null ? `${Math.round(r.avgScorePct)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
