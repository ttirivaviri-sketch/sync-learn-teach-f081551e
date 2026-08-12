/**
 * StudentHomework — dedicated learner submissions screen.
 *
 * Lists every published (AI-generated) homework for the classes the learner is
 * enrolled in, grouped by due state, and opens the answering flow inline with
 * the rubric + due date visible.
 */
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardList, ChevronLeft, CalendarClock, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStudentHomeworkList } from "@/hooks/useSchoolStudyMode";
import { SchoolHomeworkRunner } from "@/studymode/components/SchoolHomeworkRunner";

export function dueLabel(iso: string | null): { text: string; tone: "overdue" | "soon" | "later" | "none" } {
  if (!iso) return { text: "No due date", tone: "none" };
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (ms < 0) return { text: "Overdue", tone: "overdue" };
  if (days <= 1) return { text: "Due today", tone: "soon" };
  if (days <= 3) return { text: `Due in ${days} days`, tone: "soon" };
  return { text: `Due ${new Date(iso).toLocaleDateString()}`, tone: "later" };
}

export default function StudentHomework() {
  const [userId, setUserId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
  }, []);

  const { data, isLoading } = useStudentHomeworkList(userId ?? undefined);

  const groups = useMemo(() => {
    const rows = (data ?? []) as any[];
    const todo = rows.filter((h) => h.my_progress.answered === 0);
    const submitted = rows.filter((h) => h.my_progress.answered > 0 && h.my_progress.released === 0);
    const graded = rows.filter((h) => h.my_progress.released > 0);
    return { todo, submitted, graded };
  }, [data]);

  if (openId && userId) {
    return (
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setOpenId(null)} className="-ml-2">
          <ChevronLeft className="h-4 w-4 mr-1" /> All homework
        </Button>
        <SchoolHomeworkRunner homeworkId={openId} studentId={userId} onDone={() => setOpenId(null)} />
      </div>
    );
  }

  if (isLoading || !userId) {
    return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const section = (title: string, rows: any[]) =>
    rows.length === 0 ? null : (
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
        <div className="flex flex-col gap-2">
          {rows.map((h) => {
            const due = dueLabel(h.due_at);
            const total = h.total_marks ?? 0;
            const p = h.my_progress;
            return (
              <button
                key={h.id}
                onClick={() => setOpenId(h.id)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/40 transition"
              >
                <div className="min-w-0 flex items-start gap-3">
                  <GraduationCap className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{h.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {h.topic ? `${h.topic} · ` : ""}{total} marks
                    </p>
                    <p className={`text-xs mt-1 inline-flex items-center gap-1 ${
                      due.tone === "overdue" ? "text-destructive"
                        : due.tone === "soon" ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"}`}>
                      <CalendarClock className="h-3 w-3" /> {due.text}
                    </p>
                  </div>
                </div>
                <Badge variant={p.released > 0 ? "default" : p.answered > 0 ? "secondary" : "outline"} className="shrink-0">
                  {p.released > 0 ? `${p.scoreSum}/${total}` : p.answered > 0 ? "In review" : "Start"}
                </Badge>
              </button>
            );
          })}
        </div>
      </section>
    );

  const empty = (data ?? []).length === 0;

  return (
    <div className="p-4 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">My homework</h1>
      </div>

      {empty ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No homework has been released to your classes yet.
        </Card>
      ) : (
        <>
          {section("To do", groups.todo)}
          {section("Submitted — awaiting marks", groups.submitted)}
          {section("Graded", groups.graded)}
        </>
      )}
    </div>
  );
}
