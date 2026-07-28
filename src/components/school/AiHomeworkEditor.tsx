/**
 * AiHomeworkEditor — preview, edit and release AI-generated homework.
 *
 * Lets a teacher:
 *  - review every AI-generated question with a rendered (KaTeX + visual)
 *    preview of exactly what the student will see
 *  - edit prompt / expected answer / examiner notes / common mistakes / marks
 *  - delete questions before publication
 *  - set the due date
 *  - publish (status='published') so enrolled students see it,
 *    or save changes while keeping it as a draft.
 *
 * Teacher RLS on `school_homework` + `school_homework_questions` allows
 * direct UPDATE / DELETE from the client, so no extra edge function is needed
 * for the edit path. Generation still goes through `studymode-generate-homework`.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Send, Save, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  useHomeworkQuestions, useUpdateHomeworkQuestion, useDeleteHomeworkQuestion, usePublishHomework,
} from "@/hooks/useSchoolStudyMode";
import { supabase } from "@/integrations/supabase/client";
import { MathMarkdown } from "@/studymode/components/MathMarkdown";
import { QuestionVisual, type QuestionVisualSpec } from "@/studymode/components/QuestionVisual";

interface Props {
  homeworkId: string;
  classId: string;
  initialDueAt?: string | null;
  initialStatus?: string;
  initialTitle?: string;
  onClose: () => void;
}

export function AiHomeworkEditor({ homeworkId, classId, initialDueAt, initialStatus, initialTitle, onClose }: Props) {
  const qs = useHomeworkQuestions(homeworkId);
  const upd = useUpdateHomeworkQuestion();
  const del = useDeleteHomeworkQuestion();
  const pub = usePublishHomework();

  // Local edits keyed by question id.
  const [edits, setEdits] = useState<Record<string, { prompt?: string; expected_answer?: string; marks?: string; examiner_notes?: string; common_mistakes?: string }>>({});
  const [previewIds, setPreviewIds] = useState<Record<string, boolean>>({});
  const [dueAt, setDueAt] = useState<string>(
    initialDueAt ? new Date(initialDueAt).toISOString().slice(0, 16) : ""
  );
  const [title, setTitle] = useState<string>(initialTitle ?? "");

  useEffect(() => {
    setDueAt(initialDueAt ? new Date(initialDueAt).toISOString().slice(0, 16) : "");
    setTitle(initialTitle ?? "");
  }, [initialDueAt, initialTitle]);

  const flushEdits = async () => {
    const tasks = Object.entries(edits).map(async ([id, v]) => {
      const row = (qs.data ?? []).find((q: any) => q.id === id);
      if (!row) return;
      await upd.mutateAsync({
        id, homework_id: homeworkId,
        prompt: v.prompt ?? row.prompt,
        expected_answer: v.expected_answer ?? row.expected_answer,
        examiner_notes: v.examiner_notes ?? row.examiner_notes,
        common_mistakes: v.common_mistakes ?? row.common_mistakes,
        marks: v.marks !== undefined && v.marks !== "" ? Number(v.marks) : Number(row.marks),
      });
    });
    await Promise.all(tasks);
    if (title.trim() && title !== initialTitle) {
      await supabase.from("school_homework").update({ title: title.trim() }).eq("id", homeworkId);
    }
    setEdits({});
  };

  const onSaveDraft = async () => {
    try {
      await flushEdits();
      await pub.mutateAsync({
        id: homeworkId, class_id: classId, status: "draft",
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      });
      toast.success("Draft saved");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
  };

  const onPublish = async () => {
    if (!dueAt) {
      const ok = confirm("No due date set — publish without one?");
      if (!ok) return;
    }
    try {
      await flushEdits();
      await pub.mutateAsync({
        id: homeworkId, class_id: classId, status: "published",
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      });
      toast.success("Homework released to class");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Publish failed");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Review AI homework
            <Badge variant={initialStatus === "published" ? "default" : "secondary"}>
              {initialStatus ?? "draft"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Students get a notification when this is published and a reminder 24h before the due date.
            </p>
          </div>

          {qs.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (qs.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions yet.</p>
          ) : (
            <div className="space-y-3">
              {(qs.data ?? []).map((q: any) => {
                const e = edits[q.id] ?? {};
                const showPreview = previewIds[q.id] ?? false;
                const visual = (q.visual ?? null) as QuestionVisualSpec | null;
                return (
                  <div key={q.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Q{q.ord + 1} · {q.question_type}{visual ? " · has visual" : ""}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="sm" variant="ghost"
                          title="Preview as student"
                          onClick={() => setPreviewIds((s) => ({ ...s, [q.id]: !showPreview }))}
                        ><Eye className="h-4 w-4" /></Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={async () => {
                            if (!confirm("Delete this question?")) return;
                            await del.mutateAsync({ id: q.id, homework_id: homeworkId });
                          }}
                        ><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>

                    {showPreview && (
                      <div className="rounded-md bg-muted/40 border border-dashed p-3 space-y-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Student preview</p>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <MathMarkdown>{e.prompt ?? q.prompt}</MathMarkdown>
                        </div>
                        {visual && <QuestionVisual visual={visual} />}
                        {Array.isArray(q.options) && q.options.length > 0 && (
                          <ul className="space-y-1 text-sm">
                            {(q.options as string[]).map((opt, oi) => (
                              <li key={oi} className="rounded border px-2 py-1">
                                <MathMarkdown>{opt}</MathMarkdown>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    <div>
                      <Label className="text-xs">Prompt</Label>
                      <Textarea
                        rows={2}
                        value={e.prompt ?? q.prompt}
                        onChange={(ev) => setEdits((s) => ({ ...s, [q.id]: { ...s[q.id], prompt: ev.target.value } }))}
                      />
                    </div>
                    <div className="grid sm:grid-cols-[1fr_80px] gap-2">
                      <div>
                        <Label className="text-xs">Expected answer</Label>
                        <Textarea
                          rows={2}
                          value={e.expected_answer ?? q.expected_answer ?? ""}
                          onChange={(ev) => setEdits((s) => ({ ...s, [q.id]: { ...s[q.id], expected_answer: ev.target.value } }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Marks</Label>
                        <Input
                          type="number"
                          value={e.marks ?? String(q.marks ?? 1)}
                          onChange={(ev) => setEdits((s) => ({ ...s, [q.id]: { ...s[q.id], marks: ev.target.value } }))}
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Examiner notes (marking rubric)</Label>
                        <Textarea
                          rows={2}
                          value={e.examiner_notes ?? q.examiner_notes ?? ""}
                          onChange={(ev) => setEdits((s) => ({ ...s, [q.id]: { ...s[q.id], examiner_notes: ev.target.value } }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Common mistakes</Label>
                        <Textarea
                          rows={2}
                          value={e.common_mistakes ?? q.common_mistakes ?? ""}
                          onChange={(ev) => setEdits((s) => ({ ...s, [q.id]: { ...s[q.id], common_mistakes: ev.target.value } }))}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onSaveDraft} disabled={pub.isPending}>
            <Save className="h-4 w-4 mr-1" /> Save draft
          </Button>
          <Button onClick={onPublish} disabled={pub.isPending}>
            {pub.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            {initialStatus === "published" ? "Update & re-release" : "Publish to class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
