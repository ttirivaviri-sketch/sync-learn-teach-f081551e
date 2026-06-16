/**
 * SchoolHomeworkRail — appears in StudyMode dashboard for school learners.
 * Lists open + released homework with one-click open.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GraduationCap, ClipboardList } from "lucide-react";
import { useStudentHomeworkList } from "@/hooks/useSchoolStudyMode";
import { SchoolHomeworkRunner } from "./SchoolHomeworkRunner";

export function SchoolHomeworkRail({ studentId, schoolName }: { studentId: string; schoolName?: string | null }) {
  const { data, isLoading } = useStudentHomeworkList(studentId);
  const [open, setOpen] = useState<string | null>(null);

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">From {schoolName ?? "your school"}</h3>
      </div>

      <div className="flex flex-col gap-2">
        {data.slice(0, 4).map((h: any) => {
          const progress = h.my_progress;
          const total = h.total_marks ?? 0;
          const done = progress.released > 0;
          return (
            <button
              key={h.id}
              onClick={() => setOpen(h.id)}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card hover:bg-muted/40 p-3 text-left transition"
            >
              <div className="flex items-start gap-3 min-w-0">
                <GraduationCap className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{h.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {h.topic} · {total} mk{h.due_at ? ` · due ${new Date(h.due_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
              </div>
              <Badge variant={done ? "default" : progress.answered > 0 ? "secondary" : "outline"} className="shrink-0">
                {done ? `${progress.scoreSum}/${total}` : progress.answered > 0 ? "In review" : "Open"}
              </Badge>
            </button>
          );
        })}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Homework</DialogTitle></DialogHeader>
          {open && <SchoolHomeworkRunner homeworkId={open} studentId={studentId} onDone={() => setOpen(null)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
