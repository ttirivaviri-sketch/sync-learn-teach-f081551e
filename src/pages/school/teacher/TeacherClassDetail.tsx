/**
 * Teacher class detail — tabs: Stream, Materials, Homework, Quizzes, Students.
 * Each tab is a small panel with create + list interactions.
 */
import { useState } from "react";
import { useParams, useOutletContext, Link, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, FileText, ClipboardList, Megaphone, Users, Loader2, ExternalLink, BarChart3, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SchoolFileLink } from "@/components/school/SchoolFileLink";
import { SubmissionTimeline } from "@/components/school/SubmissionTimeline";
import { StudentAnalyticsPanel } from "@/components/school/StudentAnalyticsPanel";
import { AiHomeworkPanel } from "@/components/school/AiHomeworkPanel";
import { ClassPerformancePanel } from "@/components/school/ClassPerformancePanel";
import {
  useClass,
  useResources, useCreateResource, useDeleteResource,
  useAssignments, useCreateAssignment,
  useSubmissions, useGradeSubmission,
  useQuizzes, useCreateQuiz, useQuizQuestions, useUpsertQuizQuestion, useDeleteQuizQuestion,
  useAnnouncements, useCreateAnnouncement,
  useEnrollments,
} from "@/hooks/useSchoolAcademics";
import { useTeacherSchoolDocuments, useGenerateSchoolQuiz, usePreviewSchoolQuiz, useSaveSchoolQuizFromPreview, type GeneratedQuizQuestion } from "@/hooks/useSchoolStudyMode";
import { useIngestSchoolDocument } from "@/hooks/useSchoolAI";
import { extractTextFromFile } from "@/studymode/lib/pdfExtractor";

export default function TeacherClassDetail() {
  const { school } = useOutletContext<{ school: any }>();
  const { classId } = useParams();
  const [search] = useSearchParams();
  const cls = useClass(classId);

  if (cls.isLoading) return <p className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</p>;
  if (!cls.data) return <p className="text-sm text-muted-foreground">Class not found.</p>;

  // Optional deep-link from the tutor home "My Workspace" quick actions:
  //   ?tab=stream | materials | homework | quizzes | students | analytics
  const validTabs = ["stream", "materials", "homework", "quizzes", "students", "analytics"] as const;
  const initialTab = (validTabs.find((t) => t === search.get("tab")) ?? "stream") as typeof validTabs[number];

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/school/${school.id}/teach`} className="text-sm text-muted-foreground hover:underline">← My classes</Link>
        <h1 className="text-xl font-semibold mt-1">{cls.data.name}</h1>
      </div>
      <Tabs defaultValue={initialTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="stream"><Megaphone className="h-4 w-4 mr-1" />Stream</TabsTrigger>
          <TabsTrigger value="materials"><FileText className="h-4 w-4 mr-1" />Materials</TabsTrigger>
          <TabsTrigger value="homework"><ClipboardList className="h-4 w-4 mr-1" />Homework</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="students"><Users className="h-4 w-4 mr-1" />Students</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-1" />Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="stream"><StreamPanel schoolId={school.id} classId={classId!} /></TabsContent>
        <TabsContent value="materials"><MaterialsPanel schoolId={school.id} classId={classId!} /></TabsContent>
        <TabsContent value="homework">
          <div className="space-y-6 mt-3">
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">AI homework</h3>
              </div>
              <AiHomeworkPanel schoolId={school.id} classId={classId!} />
            </section>
            <section>
              <h3 className="font-semibold text-sm mb-2">Classic assignments</h3>
              <HomeworkPanel schoolId={school.id} classId={classId!} />
            </section>
          </div>
        </TabsContent>
        <TabsContent value="quizzes"><QuizzesPanel schoolId={school.id} classId={classId!} /></TabsContent>
        <TabsContent value="students"><StudentsPanel classId={classId!} /></TabsContent>
        <TabsContent value="analytics">
          <div className="space-y-6 mt-3">
            <ClassPerformancePanel classId={classId!} />
            <section>
              <h4 className="font-medium text-sm mb-2">Per-student deep dive</h4>
              <ClassAnalyticsPanel classId={classId!} />
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClassAnalyticsPanel({ classId }: { classId: string }) {
  const enrollments = useEnrollments(classId);
  const students = enrollments.data ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  if (enrollments.isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (students.length === 0) return <p className="text-sm text-muted-foreground">No students enrolled.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {students.map((e: any) => (
          <Button
            key={e.student_id}
            size="sm"
            variant={selected === e.student_id ? "default" : "outline"}
            onClick={() => setSelected(e.student_id)}
          >
            {e.profile?.full_name ?? e.student_id.slice(0, 6)}
          </Button>
        ))}
      </div>
      {selected ? (
        <StudentAnalyticsPanel userId={selected} title="Student analytics" />
      ) : (
        <p className="text-sm text-muted-foreground">Pick a student to see their learning analytics.</p>
      )}
    </div>
  );
}

function StreamPanel({ schoolId, classId }: { schoolId: string; classId: string }) {
  const list = useAnnouncements({ schoolId, classId });
  const create = useCreateAnnouncement();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <div className="space-y-3 mt-3">
      <Card className="p-4 space-y-2">
        <Label>Post to this class</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message…" />
        <div className="flex justify-end">
          <Button
            disabled={!title.trim() || !body.trim() || create.isPending}
            onClick={async () => {
              await create.mutateAsync({ school_id: schoolId, class_id: classId, audience: "class", title: title.trim(), body: body.trim() });
              setTitle(""); setBody(""); toast.success("Posted");
            }}
          >Post</Button>
        </div>
      </Card>
      {list.data?.filter((a) => a.class_id === classId).map((a) => (
        <Card key={a.id} className="p-4">
          <h3 className="font-semibold">{a.title}</h3>
          <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
          <p className="text-sm mt-1 whitespace-pre-wrap">{a.body}</p>
        </Card>
      ))}
    </div>
  );
}

function MaterialsPanel({ schoolId, classId }: { schoolId: string; classId: string }) {
  const list = useResources({ schoolId, classId });
  const create = useCreateResource();
  const del = useDeleteResource();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("note");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function submit() {
    if (!title.trim()) { toast.error("Title required"); return; }
    setUploading(true);
    try {
      let storage_path: string | null = null;
      let mime: string | null = null;
      let size_bytes: number | null = null;
      if (file) {
        const path = `${schoolId}/${classId}/${kind}/${crypto.randomUUID()}-${file.name}`;
        const { error } = await supabase.storage.from("school-content").upload(path, file, { upsert: false });
        if (error) throw error;
        storage_path = path; mime = file.type; size_bytes = file.size;
      }
      await create.mutateAsync({
        school_id: schoolId, class_id: classId, kind, title: title.trim(),
        description: description.trim() || null, visibility: "class",
        storage_path, external_url: externalUrl.trim() || null, mime, size_bytes,
      } as any);
      setTitle(""); setDescription(""); setExternalUrl(""); setFile(null);
      toast.success("Material added");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally { setUploading(false); }
  }

  return (
    <div className="space-y-3 mt-3">
      <Card className="p-4 space-y-2">
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["note","pdf","doc","ppt","image","video","past_paper","link"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Label>Description (optional)</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <Label>File (optional)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label>External URL (optional)</Label>
            <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={uploading}>{uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-1" />}Add material</Button>
        </div>
      </Card>
      <div className="divide-y border rounded-md">
        {list.data?.length === 0 && <div className="p-3 text-sm text-muted-foreground">No materials yet.</div>}
        {list.data?.map((r) => (
          <div key={r.id} className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{r.title}</div>
              <div className="text-xs text-muted-foreground">{r.kind} · {r.visibility}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {r.external_url && <a href={r.external_url} target="_blank" rel="noreferrer" className="text-sm flex items-center gap-1 px-2 py-1 hover:bg-muted rounded"><ExternalLink className="h-3 w-3" />Open</a>}
              {r.storage_path && <DownloadLink path={r.storage_path} />}
              <Button variant="ghost" size="sm" onClick={() => del.mutate(r)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DownloadLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="ghost" size="sm" disabled={loading}
      onClick={async () => {
        setLoading(true);
        const { data, error } = await supabase.storage.from("school-content").createSignedUrl(path, 60 * 10);
        setLoading(false);
        if (error || !data) return toast.error("Could not generate link");
        window.open(data.signedUrl, "_blank");
      }}
    ><ExternalLink className="h-3 w-3 mr-1" />Open</Button>
  );
}

function HomeworkPanel({ schoolId, classId }: { schoolId: string; classId: string }) {
  const list = useAssignments({ schoolId, classId });
  const create = useCreateAssignment();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [openSubsId, setOpenSubsId] = useState<string | null>(null);

  return (
    <div className="space-y-3 mt-3">
      <Card className="p-4 space-y-2">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        <Label>Instructions</Label>
        <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} />
        <div className="grid sm:grid-cols-2 gap-2">
          <div><Label>Due (optional)</Label><Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
          <div><Label>Max score</Label><Input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} /></div>
        </div>
        <div className="flex justify-end">
          <Button
            disabled={!title.trim() || create.isPending}
            onClick={async () => {
              await create.mutateAsync({
                school_id: schoolId, class_id: classId, title: title.trim(),
                instructions: instructions.trim() || null,
                due_at: dueAt ? new Date(dueAt).toISOString() : null,
                max_score: Number(maxScore) || 100, status: "published",
              } as any);
              setTitle(""); setInstructions(""); setDueAt(""); setMaxScore("100");
              toast.success("Assignment posted");
            }}
          ><Plus className="h-4 w-4 mr-1" />Create assignment</Button>
        </div>
      </Card>
      <div className="space-y-2">
        {list.data?.filter((a) => a.class_id === classId).map((a) => (
          <Card key={a.id} className="p-4 flex items-center justify-between gap-2">
            <div>
              <div className="font-medium">{a.title}</div>
              <div className="text-xs text-muted-foreground">{a.due_at ? `Due ${new Date(a.due_at).toLocaleString()}` : "No due date"} · /{a.max_score}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setOpenSubsId(a.id)}>Submissions</Button>
          </Card>
        ))}
      </div>
      {openSubsId && <SubmissionsDialog assignmentId={openSubsId} onClose={() => setOpenSubsId(null)} />}
    </div>
  );
}

function SubmissionsDialog({ assignmentId, onClose }: { assignmentId: string; onClose: () => void }) {
  const subs = useSubmissions(assignmentId);
  const grade = useGradeSubmission();
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Submissions ({subs.data?.length ?? 0})</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-auto">
          {subs.isLoading && <p className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />Loading…</p>}
          {subs.data?.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet.</p>}
          {subs.data?.map((s) => (
            <GradeRow
              key={s.id}
              sub={s}
              onGrade={(score, feedback) =>
                grade.mutate(
                  { submission: s, score, feedback },
                  {
                    onSuccess: () => toast.success("Graded — student notified"),
                    onError: (e: any) => toast.error(e.message ?? "Grading failed"),
                  }
                )
              }
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GradeRow({ sub, onGrade }: { sub: any; onGrade: (score: number, feedback: string) => void }) {
  const [score, setScore] = useState(sub.score ?? "");
  const [feedback, setFeedback] = useState(sub.feedback ?? "");
  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">
          {sub.profile?.full_name ?? sub.profile?.email ?? sub.student_id.slice(0, 8)}
          <span className="text-xs text-muted-foreground ml-1">· {sub.status}</span>
        </div>
        {sub.submitted_at && (
          <span className="text-xs text-muted-foreground">Submitted {new Date(sub.submitted_at).toLocaleString()}</span>
        )}
      </div>
      {sub.text_response && <p className="text-sm whitespace-pre-wrap p-2 bg-muted rounded">{sub.text_response}</p>}
      {!!sub.attachment_paths?.length && (
        <div className="flex flex-wrap gap-1">
          {sub.attachment_paths.map((p: string) => <SchoolFileLink key={p} path={p} />)}
        </div>
      )}
      <div className="rounded-md border p-2 bg-background/40">
        <SubmissionTimeline submission={sub} />
      </div>
      <div className="flex gap-2">
        <Input type="number" placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} className="w-24" />
        <Input placeholder="Feedback for student" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        <Button size="sm" onClick={() => onGrade(Number(score) || 0, feedback)}>{sub.status === "graded" ? "Update" : "Grade"}</Button>
      </div>
    </Card>
  );
}

function QuizzesPanel({ schoolId, classId }: { schoolId: string; classId: string }) {
  const list = useQuizzes({ schoolId, classId });
  const create = useCreateQuiz();
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-3 mt-3">
      <Card className="p-4 flex gap-2 items-end">
        <div className="flex-1">
          <Label>Quiz title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Photosynthesis check-in" />
        </div>
        <Button
          disabled={!title.trim() || create.isPending}
          onClick={async () => {
            const q = await create.mutateAsync({ school_id: schoolId, class_id: classId, title: title.trim(), status: "published" } as any);
            setTitle(""); setEditingId(q.id); toast.success("Quiz created — add questions");
          }}
        ><Plus className="h-4 w-4 mr-1" />Create blank</Button>
      </Card>

      <AiQuizGeneratorCard schoolId={schoolId} classId={classId} />

      <div className="space-y-2">
        {list.data?.filter((q) => q.class_id === classId).map((q) => (
          <Card key={q.id} className="p-4 flex items-center justify-between">
            <div className="font-medium">{q.title}</div>
            <Button size="sm" variant="outline" onClick={() => setEditingId(q.id)}>Questions</Button>
          </Card>
        ))}
      </div>
      {editingId && <QuizQuestionsDialog schoolId={schoolId} quizId={editingId} onClose={() => setEditingId(null)} />}
    </div>
  );
}

/**
 * AI-powered quiz generator. Two sources are supported:
 *   1. Pick an already-embedded school AI document.
 *   2. Upload a sample (PDF / DOCX / TXT) which is ingested first, then used.
 *
 * Either way we send the document_id to studymode-generate-school-quiz,
 * which writes a published quiz + questions for the class.
 */
function AiQuizGeneratorCard({ schoolId, classId }: { schoolId: string; classId: string }) {
  const docs = useTeacherSchoolDocuments(schoolId);
  const ingest = useIngestSchoolDocument();
  const gen = useGenerateSchoolQuiz();

  const [aiTitle, setAiTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(6);
  const [difficulty, setDifficulty] = useState("medium");
  const [sourceMode, setSourceMode] = useState<"existing" | "upload">("existing");
  const [pickedDocId, setPickedDocId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [types, setTypes] = useState<{ mcq: boolean; tf: boolean; short: boolean }>({ mcq: true, tf: false, short: false });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  const TYPE_MAP: Record<keyof typeof types, string> = {
    mcq: "multiple_choice",
    tf: "true_false",
    short: "short_answer",
  };
  const selectedTypes = (Object.keys(types) as (keyof typeof types)[]).filter((k) => types[k]).map((k) => TYPE_MAP[k]);

  async function waitForEmbedded(documentId: string) {
    // poll up to ~60s for embedding to finish
    for (let i = 0; i < 30; i++) {
      const { data } = await supabase
        .from("school_ai_documents")
        .select("status,error")
        .eq("id", documentId)
        .maybeSingle();
      if (data?.status === "embedded") return;
      if (data?.status === "failed") throw new Error(data.error ?? "Document ingest failed");
      setStatus(`Indexing sample (${data?.status ?? "queued"})…`);
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("Timed out waiting for the sample to finish indexing");
  }

  async function run() {
    if (!aiTitle.trim() || !topic.trim()) {
      toast.error("Add a quiz title and topic");
      return;
    }
    if (selectedTypes.length === 0) {
      toast.error("Pick at least one question type");
      return;
    }
    try {
      setBusy(true);
      let documentId = pickedDocId;

      if (sourceMode === "upload") {
        if (!file) { toast.error("Choose a sample file first"); setBusy(false); return; }
        setStatus("Reading sample…");
        const text = await extractTextFromFile(file);
        if (!text.trim()) throw new Error("Could not extract any text from this file");
        setStatus("Uploading to AI index…");
        const res = await ingest.mutateAsync({
          schoolId, title: file.name, content: text, classId,
        });
        documentId = res.document_id;
        await waitForEmbedded(documentId);
      }

      if (!documentId) { toast.error("Pick a source document"); setBusy(false); return; }

      setStatus("Generating questions…");
      const r = await gen.mutateAsync({
        schoolId, classId, documentId,
        title: aiTitle.trim(), topic: topic.trim(),
        count, difficulty, types: selectedTypes,
      });
      toast.success(`Quiz published — ${r.count} questions`);
      setAiTitle(""); setTopic(""); setFile(null);
    } catch (e) {
      toast.error((e as Error).message || "Generation failed");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <Card className="p-4 space-y-3 border-primary/30">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" /> Generate quiz with AI
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <Label>Quiz title</Label>
          <Input value={aiTitle} onChange={(e) => setAiTitle(e.target.value)} placeholder="Mid-unit quiz" />
        </div>
        <div>
          <Label>Topic / focus</Label>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Cell division" />
        </div>
        <div>
          <Label>Question count</Label>
          <Input type="number" min={3} max={20} value={count} onChange={(e) => setCount(Number(e.target.value) || 6)} />
        </div>
        <div>
          <Label>Difficulty</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>


      <div>
        <Label>Question types</Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {([
            { key: "mcq", label: "Multiple choice" },
            { key: "tf", label: "True / false" },
            { key: "short", label: "Short answer" },
          ] as const).map((t) => (
            <Button
              key={t.key}
              type="button"
              size="sm"
              variant={types[t.key] ? "default" : "outline"}
              onClick={() => setTypes((p) => ({ ...p, [t.key]: !p[t.key] }))}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Pick one or more — the AI will mix them in the quiz.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant={sourceMode === "existing" ? "default" : "outline"} onClick={() => setSourceMode("existing")}>Existing resource</Button>
        <Button type="button" size="sm" variant={sourceMode === "upload" ? "default" : "outline"} onClick={() => setSourceMode("upload")}>Upload sample</Button>
      </div>

      {sourceMode === "existing" ? (
        <div>
          <Label>Source document</Label>
          <Select value={pickedDocId} onValueChange={setPickedDocId}>
            <SelectTrigger>
              <SelectValue placeholder={docs.data?.length ? "Pick an indexed resource" : "No indexed resources yet — upload a sample"} />
            </SelectTrigger>
            <SelectContent>
              {(docs.data ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.title ?? "Untitled"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div>
          <Label>Sample file (PDF, DOCX or TXT)</Label>
          <Input
            type="file"
            accept=".pdf,.txt,.md,.docx,application/pdf,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && <p className="text-xs text-muted-foreground mt-1">{file.name}</p>}
        </div>
      )}

      <Button onClick={run} disabled={busy} className="w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
        {busy ? (status || "Working…") : "Generate quiz"}
      </Button>
    </Card>
  );
}

function QuizQuestionsDialog({ schoolId, quizId, onClose }: { schoolId: string; quizId: string; onClose: () => void }) {
  const qs = useQuizQuestions(quizId);
  const upsert = useUpsertQuizQuestion();
  const del = useDeleteQuizQuestion();
  const [type, setType] = useState<"mcq"|"short"|"tf"|"long">("mcq");
  const [prompt, setPrompt] = useState("");
  const [optionsText, setOptionsText] = useState("A\nB\nC\nD");
  const [answer, setAnswer] = useState("");
  const [marks, setMarks] = useState("1");

  async function add() {
    if (!prompt.trim()) return;
    let options: any = null, ans: any = null;
    if (type === "mcq") {
      options = optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
      ans = answer.trim();
    } else if (type === "tf") {
      options = ["true","false"]; ans = answer.trim().toLowerCase() === "true";
    } else {
      ans = answer.trim();
    }
    await upsert.mutateAsync({
      school_id: schoolId, quiz_id: quizId, type, prompt: prompt.trim(),
      options, answer: ans, marks: Number(marks) || 1, ord: (qs.data?.length ?? 0) + 1,
    });
    setPrompt(""); setAnswer(""); toast.success("Added");
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Quiz questions</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-auto">
          <Card className="p-3 space-y-2">
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple choice</SelectItem>
                    <SelectItem value="tf">True / false</SelectItem>
                    <SelectItem value="short">Short answer</SelectItem>
                    <SelectItem value="long">Long answer (manual grade)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Marks</Label><Input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} /></div>
            </div>
            <Label>Prompt</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} />
            {type === "mcq" && (<>
              <Label>Options (one per line)</Label>
              <Textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={4} />
            </>)}
            {type !== "long" && (<>
              <Label>Correct answer {type === "mcq" && "(exact text of the correct option)"}{type === "tf" && "(true or false)"}</Label>
              <Input value={answer} onChange={(e) => setAnswer(e.target.value)} />
            </>)}
            <div className="flex justify-end"><Button onClick={add}><Plus className="h-4 w-4 mr-1" />Add question</Button></div>
          </Card>
          {qs.data?.map((q) => (
            <Card key={q.id} className="p-3 flex items-start justify-between gap-2">
              <div className="text-sm">
                <div className="font-medium">{q.ord}. {q.prompt}</div>
                <div className="text-xs text-muted-foreground">{q.type} · {q.marks} mark{Number(q.marks) === 1 ? "" : "s"}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => del.mutate(q)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StudentsPanel({ classId }: { classId: string }) {
  const enr = useEnrollments(classId);
  return (
    <div className="mt-3">
      <Card className="divide-y">
        {enr.data?.length === 0 && <div className="p-4 text-sm text-muted-foreground">No students enrolled yet.</div>}
        {enr.data?.map((e) => (
          <div key={e.id} className="p-3 flex items-center justify-between text-sm">
            <div>
              <div className="font-medium">{e.profile?.full_name ?? "Student"}</div>
              <div className="text-xs text-muted-foreground">{e.profile?.email}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
