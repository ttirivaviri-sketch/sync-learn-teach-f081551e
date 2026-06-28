/**
 * TopicStudentsDialog — drill-down showing which students in a class or
 * across the whole school are struggling with a specific topic, so teachers
 * can prioritise follow-ups (1-on-1, study group, remediation homework).
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Wand2, Users } from "lucide-react";
import { useClassTopicStudents, useSchoolTopicStudents, type AffectedStudent } from "@/hooks/useKernelAlerts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scope: "class" | "school";
  scopeId: string;
  topic: string | null;
  onAssign?: () => void;
}

const riskColor: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  watch: "bg-yellow-400/15 text-yellow-700 dark:text-yellow-300",
  on_track: "bg-emerald-400/15 text-emerald-700 dark:text-emerald-300",
  mastered: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
};

export function TopicStudentsDialog({ open, onOpenChange, scope, scopeId, topic, onAssign }: Props) {
  const classQ = useClassTopicStudents(scope === "class" ? scopeId : undefined, topic);
  const schoolQ = useSchoolTopicStudents(scope === "school" ? scopeId : undefined, topic);
  const q = scope === "class" ? classQ : schoolQ;
  const rows = (q.data ?? []) as AffectedStudent[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Students affected — <span className="text-primary">{topic}</span>
          </DialogTitle>
        </DialogHeader>

        {q.isLoading && <Skeleton className="h-24 w-full" />}
        {!q.isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No students currently flagged on this topic.</p>
        )}

        {rows.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Student</th>
                  <th className="text-left px-3 py-2">Risk</th>
                  <th className="text-right px-3 py-2">EWMA</th>
                  <th className="text-right px-3 py-2">Mastery</th>
                  {scope === "school" && <th className="text-left px-3 py-2">Classes</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student_id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.full_name ?? "Student"}</div>
                      {r.email && <div className="text-[11px] text-muted-foreground">{r.email}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className={`text-[10px] ${riskColor[r.risk_level ?? "on_track"] ?? ""}`}>
                        {r.risk_level ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.ewma_score_pct != null ? `${Math.round(Number(r.ewma_score_pct))}%` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.mastery_pct != null ? `${Math.round(Number(r.mastery_pct))}%` : "—"}</td>
                    {scope === "school" && (
                      <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[180px]">{r.class_names ?? "—"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {onAssign && rows.length > 0 && (
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={onAssign}>
              <Wand2 className="h-3.5 w-3.5 mr-1" />Assign remediation
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
