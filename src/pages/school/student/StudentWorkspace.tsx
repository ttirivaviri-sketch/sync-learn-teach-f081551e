/**
 * Student school workspace — Today (assignments + quizzes due across enrolled
 * classes) plus per-class drill-down, assignment submit, and quiz runner.
 * Uses internal routing via `view` state to avoid creating many route files.
 */
import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, ClipboardList, FileText, ExternalLink, ChevronRight, GraduationCap, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useMyEnrolledClasses, useStudentTodayFeed, useGrades,
  useAssignments, useAssignment, useMySubmission, useSubmitAssignment, uploadSubmissionFile,
  useQuizzes, useQuiz, useQuizQuestions, useStartQuizAttempt, useSubmitQuizAttempt, useMyQuizAttempts,
  useResources, useAnnouncements,
} from "@/hooks/useSchoolAcademics";
import { useStudentAnalytics } from "@/hooks/useStudentAnalytics";
import { MathMarkdown } from "@/studymode/components/MathMarkdown";
import { SubmissionTimeline } from "@/components/school/SubmissionTimeline";
import { SchoolFileLink } from "@/components/school/SchoolFileLink";
import { LearningCompanion } from "@/components/learner/LearningCompanion";
import { cn } from "@/lib/utils";

const BRAND_GRADIENT = "linear-gradient(135deg, hsl(228 89% 60%), hsl(248 88% 64%))";

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function dueInLabel(iso: string | null) {
  if (!iso) return "No due date";
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return "Overdue";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

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

type HomeTab = "overview" | "classes" | "announcements";

function HomeView({ school, onOpen }: { school: any; onOpen: (v: View) => void }) {
  const [tab, setTab] = useState<HomeTab>("overview");
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
  }, []);
  const today = useStudentTodayFeed(school.id);
  const classes = useMyEnrolledClasses(school.id);
  const announcements = useAnnouncements({ schoolId: school.id });
  const grades = useGrades(school.id);
  const analytics = useStudentAnalytics(undefined, 30);

  const gradeName = (id: string | null) => grades.data?.find((g) => g.id === id)?.name ?? "";

  const weekMs = 7 * 86400000;
  const dueThisWeek =
    (today.data?.assignments.filter((a) => a.due_at && new Date(a.due_at).getTime() - Date.now() < weekMs && new Date(a.due_at).getTime() > Date.now() - 86400000).length ?? 0) +
    (today.data?.quizzes.filter((q) => q.due_at && new Date(q.due_at).getTime() - Date.now() < weekMs && new Date(q.due_at).getTime() > Date.now() - 86400000).length ?? 0);
  const quizPct = analytics.data?.rollup_30d?.quiz_pct ?? 0;
  const rollup = analytics.data?.rollup_30d;
  const latest = announcements.data?.[0];

  const tabs: { id: HomeTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "classes", label: "My classes" },
    { id: "announcements", label: "Announce." },
  ];

  return (
    <div className="space-y-4">
      {/* Pill tab nav — mockup p.17 */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium border transition-colors",
              tab === t.id ? "text-white border-transparent" : "bg-card text-muted-foreground hover:text-foreground",
            )}
            style={tab === t.id ? { background: BRAND_GRADIENT } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          {/* Stats trio — mockup p.17 */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-3 text-center">
              <div className="text-xl font-bold text-red-500">{dueThisWeek}</div>
              <div className="text-[11px] text-muted-foreground">due this week</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-xl font-bold text-emerald-600">{quizPct}%</div>
              <div className="text-[11px] text-muted-foreground">quiz avg</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-xl font-bold text-primary">{classes.data?.length ?? 0}</div>
              <div className="text-[11px] text-muted-foreground">{(classes.data?.length ?? 0) === 1 ? "class" : "classes"}</div>
            </Card>
          </div>

          {/* Study Companion — context-aware book/video suggestions from live study signals */}
          <LearningCompanion userId={userId} />

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due soon</h2>
            {today.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <div className="space-y-2">
                {today.data?.assignments.length === 0 && today.data?.quizzes.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing due right now. 🎉</p>
                )}
                {today.data?.assignments.map((a) => (
                  <Card key={a.id} role="button" onClick={() => onOpen({ kind: "assignment", id: a.id, schoolId: school.id })} className="p-3 cursor-pointer hover:bg-muted/40">
                    <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0 text-sm">
                        <span className="font-medium">{a.title}</span>
                        <span className="text-muted-foreground"> — Homework, {dueInLabel(a.due_at)}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </Card>
                ))}
                {today.data?.quizzes.map((q) => (
                  <Card key={q.id} role="button" onClick={() => onOpen({ kind: "quiz", id: q.id, schoolId: school.id })} className="p-3 cursor-pointer hover:bg-muted/40">
                    <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0 text-sm">
                        <span className="font-medium">{q.title}</span>
                        <span className="text-muted-foreground"> — Quiz, {dueInLabel(q.due_at)}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest announcement</h2>
            {latest ? (
              <Card className="p-3">
                <div className="font-semibold text-sm">{latest.title}</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {timeAgo(latest.created_at)}
                  {latest.grade_id ? ` · ${gradeName(latest.grade_id)}` : latest.audience === "school" ? " · School-wide" : ""}
                </p>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            )}
          </section>
        </div>
      )}

      {tab === "classes" && (
        <div className="space-y-4">
          {/* Personal activity stats — mockup p.18: every stat is the student's own */}
          {rollup && (
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Your activity</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="font-bold">{rollup.tasks ?? 0}</div>
                  <div className="text-[11px] text-muted-foreground">Tasks (30d)</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="font-bold">{rollup.homework ?? 0}</div>
                  <div className="text-[11px] text-muted-foreground">Homework</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="font-bold">{rollup.quiz_pct ?? 0}%</div>
                  <div className="text-[11px] text-muted-foreground">Quiz avg</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="font-bold">{rollup.flashcards ?? 0}</div>
                  <div className="text-[11px] text-muted-foreground">Flashcards</div>
                </div>
              </div>
            </Card>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">My classes</h2>
            {classes.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground">You aren't enrolled in any classes yet.</p>
            ) : (
              <div className="space-y-2">
                {classes.data?.map((c) => (
                  <Card key={c.id} role="button" onClick={() => onOpen({ kind: "class", classId: c.id })} className="p-3 cursor-pointer hover:bg-muted/40">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
                        <GraduationCap className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {school.name}{c.grade_id && gradeName(c.grade_id) ? ` · ${gradeName(c.grade_id)}` : ""}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "announcements" && (
        <div className="space-y-3">
          <button className="flex items-center gap-1 text-xs text-muted-foreground">
            Filter: All <ChevronDown className="h-3 w-3" />
          </button>
          {announcements.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <div className="space-y-2">
              {(announcements.data?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">No announcements yet.</p>
              )}
              {announcements.data?.map((a) => (
                <Card key={a.id} className="p-3">
                  <div className="font-semibold text-sm">{a.title}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {timeAgo(a.created_at)}
                    {a.grade_id ? ` · ${gradeName(a.grade_id)}` : a.audience === "school" ? " · School-wide" : ""}
                  </p>
                  <p className="text-sm mt-1.5 whitespace-pre-wrap">{a.body}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
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
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const sub = mine.data;
  const isFinal = !!sub && sub.status !== "draft" && (sub.status as string) !== "not_started";

  async function handleSubmit(final: boolean) {
    setUploading(true);
    try {
      let attachment_paths: string[] | undefined;
      if (file) {
        const path = await uploadSubmissionFile({ schoolId, assignmentId: id, file });
        attachment_paths = [path];
      }
      await submit.mutateAsync({
        school_id: schoolId, assignment_id: id,
        text_response: text || sub?.text_response || "",
        final, attachment_paths,
      });
      setFile(null);
      toast.success(final ? "Submitted" : "Saved draft");
    } catch (e: any) {
      toast.error(e.message ?? "Submission failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:underline">← Back</button>
      {a.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : a.data && (
        <>
          <h1 className="text-xl font-semibold">{a.data.title}</h1>
          <p className="text-xs text-muted-foreground">{a.data.due_at ? `Due ${new Date(a.data.due_at).toLocaleString()}` : "No due date"}{a.data.max_score ? ` · ${a.data.max_score} marks` : ""}</p>
          {a.data.instructions && <Card className="p-3 text-sm whitespace-pre-wrap">{a.data.instructions}</Card>}

          <Card className="p-3">
            <div className="text-sm font-medium mb-2">Progress</div>
            <SubmissionTimeline submission={sub} />
          </Card>

          {sub?.status === "graded" && (
            <Card className="p-3 bg-muted/40">
              <div className="font-medium">Grade: {sub.score} / {a.data.max_score}</div>
              {sub.feedback && <p className="text-sm mt-1 whitespace-pre-wrap"><span className="font-medium">Feedback: </span>{sub.feedback}</p>}
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
            {!!sub?.attachment_paths?.length && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Uploaded files</div>
                {sub.attachment_paths.map((p) => <SchoolFileLink key={p} path={p} />)}
              </div>
            )}
            {!isFinal && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Attach a file (optional)</label>
                  <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" disabled={uploading} onClick={() => handleSubmit(false)}>Save draft</Button>
                  <Button disabled={uploading} onClick={() => handleSubmit(true)}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Submit
                  </Button>
                </div>
              </>
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
          <div className="font-medium text-sm flex gap-1.5">
            <span>{qq.ord}.</span>
            <MathMarkdown className="[&_p]:my-0">{String(qq.prompt ?? "")}</MathMarkdown>
          </div>
          {qq.type === "mcq" && Array.isArray(qq.options) && qq.options.map((opt: string) => (
            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name={qq.id} checked={answers[qq.id] === opt} onChange={() => setAnswers((p) => ({ ...p, [qq.id]: opt }))} />
              <MathMarkdown className="inline [&_p]:inline [&_p]:my-0">{String(opt)}</MathMarkdown>
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
