/**
 * Student school workspace — Today (assignments + quizzes due across enrolled
 * classes) plus per-class drill-down, assignment submit, and quiz runner.
 * Uses internal routing via `view` state to avoid creating many route files.
 */
import { useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, ClipboardList, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useMyEnrolledClasses, useStudentTodayFeed,
  useAssignments, useAssignment, useMySubmission, useSubmitAssignment,
  useQuizzes, useQuiz, useQuizQuestions, useStartQuizAttempt, useSubmitQuizAttempt, useMyQuizAttempts,
  useResources, useAnnouncements,
} from "@/hooks/useSchoolAcademics";

type View =
  | { kind: "home" }
  | { kind: "class"; classId: string }
  | { kind: "assignment"; id: string; schoolId: string }
  | { kind: "quiz"; id: string; schoolId: string };

export default function StudentWorkspace() {
  const { school } = useOutletContext<{ school: any }>();
  const [view, setView] = useState<View>({ kind: "home" });

  if (view.kind === "assignment") return <AssignmentView id={view.id} schoolId={view.schoolId} onBack={() => setView({ kind: "home" })} />;
  if (view.kind === "quiz") return <QuizView id={view.id} schoolId={view.schoolId} onBack={() => setView({ kind: "home" })} />;
  if (view.kind === "class") return <ClassView schoolId={school.id} classId={view.classId} onBack={() => setView({ kind: "home" })} onOpen={setView} />;
  return <HomeView school={school} onOpen={setView} />;
}

function HomeView({ school, onOpen }: { school: any; onOpen: (v: View) => void }) {
  const today = useStudentTodayFeed(school.id);
  const classes = useMyEnrolledClasses(school.id);
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-2">Due soon</h2>
        {today.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <div className="space-y-2">
            {today.data?.assignments.length === 0 && today.data?.quizzes.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing due right now. 🎉</p>
            )}
            {today.data?.assignments.map((a) => (
              <Card key={a.id} role="button" onClick={() => onOpen({ kind: "assignment", id: a.id, schoolId: school.id })} className="p-3 cursor-pointer hover:bg-muted/40">
                <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.due_at ? `Due ${new Date(a.due_at).toLocaleString()}` : "No due date"}</div>
                  </div>
                </div>
              </Card>
            ))}
            {today.data?.quizzes.map((q) => (
              <Card key={q.id} role="button" onClick={() => onOpen({ kind: "quiz", id: q.id, schoolId: school.id })} className="p-3 cursor-pointer hover:bg-muted/40">
                <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{q.title}</div>
                    <div className="text-xs text-muted-foreground">Quiz {q.due_at ? `· due ${new Date(q.due_at).toLocaleString()}` : ""}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-2">My classes</h2>
        {classes.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">You aren't enrolled in any classes yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {classes.data?.map((c) => (
              <Card key={c.id} role="button" onClick={() => onOpen({ kind: "class", classId: c.id })} className="p-3 cursor-pointer hover:bg-muted/40">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">Class</div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ClassView({ schoolId, classId, onBack, onOpen }: { schoolId: string; classId: string; onBack: () => void; onOpen: (v: View) => void }) {
  const assignments = useAssignments({ schoolId, classId });
  const quizzes = useQuizzes({ schoolId, classId });
  const resources = useResources({ schoolId, classId });
  const announcements = useAnnouncements({ schoolId, classId });
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:underline">← Back</button>
      <section>
        <h2 className="font-semibold">Announcements</h2>
        <div className="space-y-2 mt-2">
          {announcements.data?.filter((a) => a.class_id === classId || a.audience === "school").slice(0, 5).map((a) => (
            <Card key={a.id} className="p-3"><div className="font-medium text-sm">{a.title}</div><p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p><p className="text-sm mt-1 whitespace-pre-wrap">{a.body}</p></Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-semibold">Materials</h2>
        <div className="space-y-1 mt-2">
          {resources.data?.length === 0 && <p className="text-sm text-muted-foreground">No materials shared yet.</p>}
          {resources.data?.map((r) => (
            <Card key={r.id} className="p-3 flex items-center justify-between gap-2">
              <div><div className="font-medium text-sm">{r.title}</div><div className="text-xs text-muted-foreground">{r.kind}</div></div>
              {r.external_url ? <a href={r.external_url} target="_blank" rel="noreferrer" className="text-sm flex items-center gap-1 hover:underline"><ExternalLink className="h-3 w-3" />Open</a> : r.storage_path && <DownloadLink path={r.storage_path} />}
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-semibold">Homework</h2>
        <div className="space-y-1 mt-2">
          {assignments.data?.filter((a) => a.class_id === classId).map((a) => (
            <Card key={a.id} role="button" onClick={() => onOpen({ kind: "assignment", id: a.id, schoolId })} className="p-3 cursor-pointer hover:bg-muted/40">
              <div className="font-medium text-sm">{a.title}</div>
              <div className="text-xs text-muted-foreground">{a.due_at ? `Due ${new Date(a.due_at).toLocaleString()}` : "No due date"}</div>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-semibold">Quizzes</h2>
        <div className="space-y-1 mt-2">
          {quizzes.data?.filter((q) => q.class_id === classId).map((q) => (
            <Card key={q.id} role="button" onClick={() => onOpen({ kind: "quiz", id: q.id, schoolId })} className="p-3 cursor-pointer hover:bg-muted/40">
              <div className="font-medium text-sm">{q.title}</div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function DownloadLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button variant="ghost" size="sm" disabled={loading}
      onClick={async () => {
        setLoading(true);
        const { data, error } = await supabase.storage.from("school-content").createSignedUrl(path, 600);
        setLoading(false);
        if (error || !data) return toast.error("Could not generate link");
        window.open(data.signedUrl, "_blank");
      }}><ExternalLink className="h-3 w-3 mr-1" />Open</Button>
  );
}

function AssignmentView({ id, schoolId, onBack }: { id: string; schoolId: string; onBack: () => void }) {
  const a = useAssignment(id);
  const mine = useMySubmission(id);
  const submit = useSubmitAssignment();
  const [text, setText] = useState("");
  const sub = mine.data;
  const isFinal = sub && sub.status !== "draft" && sub.status !== "not_started";

  return (
    <div className="space-y-3 max-w-2xl">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:underline">← Back</button>
      {a.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : a.data && (
        <>
          <h1 className="text-xl font-semibold">{a.data.title}</h1>
          <p className="text-xs text-muted-foreground">{a.data.due_at ? `Due ${new Date(a.data.due_at).toLocaleString()}` : "No due date"} · /{a.data.max_score}</p>
          {a.data.instructions && <Card className="p-3 text-sm whitespace-pre-wrap">{a.data.instructions}</Card>}
          {sub?.status === "graded" && (
            <Card className="p-3 bg-muted/40">
              <div className="font-medium">Grade: {sub.score} / {a.data.max_score}</div>
              {sub.feedback && <p className="text-sm mt-1">{sub.feedback}</p>}
            </Card>
          )}
          <Card className="p-3 space-y-2">
            <div className="text-sm font-medium">Your response</div>
            <Textarea
              rows={6}
              value={text || sub?.text_response || ""}
              onChange={(e) => setText(e.target.value)}
              disabled={isFinal}
            />
            {!isFinal && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => submit.mutate({ school_id: schoolId, assignment_id: id, text_response: text || sub?.text_response || "", final: false }, { onSuccess: () => toast.success("Saved draft") })}>Save draft</Button>
                <Button onClick={() => submit.mutate({ school_id: schoolId, assignment_id: id, text_response: text || sub?.text_response || "", final: true }, { onSuccess: () => toast.success("Submitted") })}>Submit</Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function QuizView({ id, schoolId, onBack }: { id: string; schoolId: string; onBack: () => void }) {
  const q = useQuiz(id);
  const qs = useQuizQuestions(id);
  const attempts = useMyQuizAttempts(id);
  const start = useStartQuizAttempt();
  const submit = useSubmitQuizAttempt();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState<{ score: number; max: number } | null>(null);

  if (q.isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (!q.data) return null;

  if (!attemptId && !submitted) {
    const last = attempts.data?.[0];
    return (
      <div className="space-y-3 max-w-xl">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:underline">← Back</button>
        <h1 className="text-xl font-semibold">{q.data.title}</h1>
        {q.data.instructions && <p className="text-sm">{q.data.instructions}</p>}
        <p className="text-xs text-muted-foreground">{qs.data?.length ?? 0} questions · attempts used: {attempts.data?.length ?? 0}/{q.data.attempts_allowed}</p>
        {last && last.status !== "in_progress" && (
          <Card className="p-3"><div className="font-medium">Previous: {last.score} / {last.max_score}</div></Card>
        )}
        <Button
          disabled={start.isPending || (attempts.data && attempts.data.length >= q.data.attempts_allowed)}
          onClick={async () => {
            const a = await start.mutateAsync({ school_id: schoolId, quiz_id: id });
            setAttemptId(a.id);
          }}
        >Start quiz</Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="space-y-3 max-w-xl">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:underline">← Back</button>
        <Card className="p-4"><div className="text-lg font-semibold">Score: {submitted.score} / {submitted.max}</div></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-lg font-semibold">{q.data.title}</h1>
      {qs.data?.map((qq) => (
        <Card key={qq.id} className="p-3 space-y-2">
          <div className="font-medium text-sm">{qq.ord}. {qq.prompt}</div>
          {qq.type === "mcq" && Array.isArray(qq.options) && qq.options.map((opt: string) => (
            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name={qq.id} checked={answers[qq.id] === opt} onChange={() => setAnswers((p) => ({ ...p, [qq.id]: opt }))} />
              {opt}
            </label>
          ))}
          {qq.type === "tf" && ["true","false"].map((v) => (
            <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name={qq.id} checked={answers[qq.id] === (v === "true")} onChange={() => setAnswers((p) => ({ ...p, [qq.id]: v === "true" }))} />
              {v}
            </label>
          ))}
          {(qq.type === "short" || qq.type === "long") && (
            <Textarea rows={qq.type === "long" ? 4 : 2} value={answers[qq.id] ?? ""} onChange={(e) => setAnswers((p) => ({ ...p, [qq.id]: e.target.value }))} />
          )}
        </Card>
      ))}
      <div className="flex justify-end">
        <Button
          onClick={async () => {
            const attempt = { id: attemptId, school_id: schoolId, quiz_id: id } as any;
            const ans = (qs.data ?? []).map((q) => ({ question_id: q.id, response: answers[q.id] }));
            const res = await submit.mutateAsync({ attempt, answers: ans, questions: qs.data ?? [] });
            setSubmitted({ score: Number(res.score) || 0, max: Number(res.max_score) || 0 });
            setAttemptId(null);
          }}
        >Submit quiz</Button>
      </div>
    </div>
  );
}
