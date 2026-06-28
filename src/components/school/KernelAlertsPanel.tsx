/**
 * KernelAlertsPanel — surfaces newly-detected at-risk topics for a school
 * (populated hourly by detect-kernel-alerts-hourly pg_cron). Admins can
 * acknowledge, dismiss, drill into the students, or jump straight to a
 * class to trigger remediation homework prefill.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Bell, BellOff, Check, Users, Wand2 } from "lucide-react";
import { useKernelAlerts, useUpdateKernelAlert, type KernelAlertRow } from "@/hooks/useKernelAlerts";
import { TopicStudentsDialog } from "./TopicStudentsDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function useSchoolClassesLite(schoolId?: string) {
  return useQuery({
    queryKey: ["school-classes-lite", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const [clsRes, csRes] = await Promise.all([
        supabase.from("classes").select("id,name").eq("school_id", schoolId!),
        supabase.from("class_subjects").select("class_id,subject_id").eq("school_id", schoolId!),
      ]);
      const subjectByClass = new Map<string, string[]>();
      for (const cs of (csRes.data ?? []) as any[]) {
        const arr = subjectByClass.get(cs.class_id) ?? [];
        arr.push(cs.subject_id);
        subjectByClass.set(cs.class_id, arr);
      }
      return ((clsRes.data ?? []) as any[]).map((c) => ({ ...c, subject_ids: subjectByClass.get(c.id) ?? [] }));
    },
  });
}

export function KernelAlertsPanel({ schoolId }: { schoolId: string }) {
  const alerts = useKernelAlerts(schoolId, ["new", "acknowledged"]);
  const update = useUpdateKernelAlert();
  const classes = useSchoolClassesLite(schoolId);
  const navigate = useNavigate();
  const [drillTopic, setDrillTopic] = useState<string | null>(null);

  const list = (alerts.data ?? []) as KernelAlertRow[];

  const goAssign = (a: KernelAlertRow) => {
    const all = (classes.data ?? []) as any[];
    const cls = all.find((c) => a.subject_id && c.subject_ids.includes(a.subject_id)) ?? all[0];
    if (!cls) return;
    navigate(`/school/${schoolId}/classes/${cls.id}?tab=homework`);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("los:prefill-homework", {
        detail: { topic: a.topic, alertId: a.id },
      }));
    }, 250);
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold text-sm">At-risk topic alerts</h3>
          <Badge variant="outline" className="ml-auto text-[10px]">
            {list.length} active
          </Badge>
        </div>

        {alerts.isLoading && <Skeleton className="h-16 w-full" />}

        {!alerts.isLoading && list.length === 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <BellOff className="h-3.5 w-3.5" /> No emerging risks right now. The kernel re-scans hourly.
          </p>
        )}

        <ul className="space-y-2">
          {list.map((a) => (
            <li key={a.id} className="rounded-md bg-background/70 border p-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <AlertTriangle className={`h-3.5 w-3.5 ${a.severity === "critical" ? "text-destructive" : "text-amber-600"}`} />
                <span className="font-medium text-sm truncate">{a.topic}</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${a.severity === "critical" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}
                >
                  {a.severity}
                </Badge>
                {a.delta_students > 0 && (
                  <Badge variant="outline" className="text-[10px]">+{a.delta_students} new</Badge>
                )}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {new Date(a.detected_at).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {a.students_affected} student(s) affected{a.avg_score != null && ` · avg ${Math.round(Number(a.avg_score))}%`}
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setDrillTopic(a.topic)}>
                  <Users className="h-3 w-3 mr-1" />Who
                </Button>
                <Button size="sm" className="h-7 text-[11px]" onClick={() => goAssign(a)}>
                  <Wand2 className="h-3 w-3 mr-1" />Assign remediation
                </Button>
                {a.status === "new" && (
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                    onClick={() => update.mutate({ id: a.id, status: "acknowledged" })}>
                    <Check className="h-3 w-3 mr-1" />Acknowledge
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                  onClick={() => update.mutate({ id: a.id, status: "dismissed" })}>
                  Dismiss
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      <TopicStudentsDialog
        open={!!drillTopic}
        onOpenChange={(v) => !v && setDrillTopic(null)}
        scope="school"
        scopeId={schoolId}
        topic={drillTopic}
      />
    </Card>
  );
}
