/**
 * TeacherHomeworkReview — list a teacher's homework + per-student review queue.
 * Lets the teacher override AI scores, leave comments, and release grades.
 */
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useTeacherHomeworkList,
  useHomeworkReviewQueue,
  useReleaseHomework,
} from "@/hooks/useSchoolStudyMode";
import { useToast } from "@/hooks/use-toast";

export default function TeacherHomeworkReview() {
  const { school } = useOutletContext<{ school: any }>();
  const { session } = useAuth();
  const teacherId = session?.user?.id ?? "";
  const list = useTeacherHomeworkList(school.id, teacherId);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Homework review</h1>
        <p className="text-sm text-muted-foreground">AI marks each submission. Override scores and release grades.</p>
      </div>

      {list.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (list.data ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No homework yet. Generate one from a teaching resource in your class.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.data!.map((h: any) => (
            <Card key={h.id} role="button" onClick={() => setSelected(h.id)}
              className={`p-4 cursor-pointer transition ${selected === h.id ? "border-primary" : "hover:bg-muted/40"}`}>
              <h3 className="font-medium">{h.title}</h3>
              <p className="text-xs text-muted-foreground">{h.topic} · {h.total_marks} mk</p>
            </Card>
          ))}
        </div>
      )}

      {selected && <ReviewQueue schoolId={school.id} homeworkId={selected} />}
    </div>
  );
}

function ReviewQueue({ schoolId, homeworkId }: { schoolId: string; homeworkId: string }) {
  const { toast } = useToast();
  const q = useHomeworkReviewQueue(homeworkId);
  const rel = useReleaseHomework();
  const [edits, setEdits] = useState<Record<string, { score?: string; comment?: string }>>({});

  const releaseAll = async () => {
    try {
      const overrides = Object.entries(edits)
        .map(([rid, v]) => {
          const row = (q.data ?? []).find((r: any) => r.id === rid);
          if (!row) return null;
          return {
            // response_id scopes the override to THIS student's answer row.
            // (question_id alone would hit every student's response to the
            // same question — kept only as legacy fallback server-side.)
            response_id: rid,
            question_id: row.question_id,
            teacher_score: v.score !== undefined && v.score !== "" ? Number(v.score) : undefined,
            teacher_comment: v.comment,
          };
        })
        .filter(Boolean) as any[];
      const r = await rel.mutateAsync({ schoolId, homeworkId, overrides });
      const skipped = Number(r.skipped_unmarked ?? 0);
      toast({
        title: "Released",
        description: skipped > 0
          ? `${r.released} response(s) released. ${skipped} unmarked response(s) were skipped — enter a teacher score for them first.`
          : `${r.released} response(s) released to students.`,
      });
    } catch (e) {
      toast({ title: "Release failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  // Group responses per student so the teacher marks one submission at a time.
  const rows = (q.data ?? []) as any[];
  const byStudent = new Map<string, any[]>();
  for (const r of rows) {
    const arr = byStudent.get(r.student_id) ?? [];
    arr.push(r);
    byStudent.set(r.student_id, arr);
  }
  const unmarkedTotal = rows.filter((r) => r.status === "submitted").length;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">Submissions</h3>
          <Badge variant="secondary">{byStudent.size} student{byStudent.size === 1 ? "" : "s"}</Badge>
          {unmarkedTotal > 0 && (
            <Badge variant="destructive">{unmarkedTotal} need manual marking</Badge>
          )}
        </div>
        <Button onClick={releaseAll} disabled={rel.isPending}>
          {rel.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Release grades
        </Button>
      </div>
      {q.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No submissions yet.</p>
      ) : (
        <div className="space-y-4">
          {[...byStudent.entries()].map(([studentId, responses]) => {
            const name = responses[0]?.student_name ?? `Student ${studentId.slice(0, 8)}…`;
            const aiTotal = responses.reduce((s, r) => s + Number(r.teacher_score ?? r.ai_score ?? 0), 0);
            const sorted = [...responses].sort((a, b) => (a.question?.ord ?? 0) - (b.question?.ord ?? 0));
            return (
              <div key={studentId} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{name}</span>
                  <span className="text-xs text-muted-foreground">Current total: {aiTotal}</span>
                </div>
                {sorted.map((r: any) => (
                  <Card key={r.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
                      <span className="flex-1">
                        {r.question ? `Q${(r.question.ord ?? 0) + 1}. ${r.question.prompt}` : "Question"}
                        {r.question?.marks != null && ` (${r.question.marks} mk)`}
                      </span>
                      <Badge variant={r.status === "released" ? "default" : r.status === "submitted" ? "destructive" : "secondary"} className="shrink-0">
                        {r.status === "submitted" ? "needs marking" : r.status}
                      </Badge>
                    </div>
                    <p className="text-sm"><span className="font-medium">Answer:</span> {r.student_answer || <em>blank</em>}</p>
                    <p className="text-xs text-muted-foreground">
                      AI score: {r.ai_score ?? "— (AI marking failed, enter a score)"}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number" placeholder="Teacher score"
                        value={edits[r.id]?.score ?? r.teacher_score ?? ""}
                        onChange={(e) => setEdits((s) => ({ ...s, [r.id]: { ...s[r.id], score: e.target.value } }))}
                      />
                      <Textarea
                        placeholder="Comment" rows={1}
                        value={edits[r.id]?.comment ?? r.teacher_comment ?? ""}
                        onChange={(e) => setEdits((s) => ({ ...s, [r.id]: { ...s[r.id], comment: e.target.value } }))}
                      />
                    </div>
                    {r.status === "released" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
