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
import { useTeacherSchoolDocuments, usePreviewSchoolQuiz, useSaveSchoolQuizFromPreview, type GeneratedQuizQuestion } from "@/hooks/useSchoolStudyMode";
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
  const preview = usePreviewSchoolQuiz();

  const [aiTitle, setAiTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [sourceMode, setSourceMode] = useState<"existing" | "upload">("existing");
  const [pickedDocId, setPickedDocId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [counts, setCounts] = useState<{ mcq: number; tf: number; short: number }>({ mcq: 4, tf: 0, short: 0 });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  // Preview state — held in memory until the teacher saves
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewQs, setPreviewQs] = useState<GeneratedQuizQuestion[]>([]);
  const [previewDocId, setPreviewDocId] = useState<string>("");

  const totalCount = counts.mcq + counts.tf + counts.short;

  async function waitForEmbedded(documentId: string) {
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
    if (!aiTitle.trim() || !topic.trim()) { toast.error("Add a quiz title and topic"); return; }
    if (totalCount === 0) { toast.error("Set at least one question count above 0"); return; }
    if (totalCount > 30) { toast.error("Maximum 30 questions per quiz"); return; }
    try {
      setBusy(true);
      let documentId = pickedDocId;

      if (sourceMode === "upload") {
        if (!file) { toast.error("Choose a sample file first"); setBusy(false); return; }
        setStatus("Reading sample…");
        const text = await extractTextFromFile(file);
        if (!text.trim()) throw new Error("Could not extract any text from this file");
        setStatus("Uploading to AI index…");
        const res = await ingest.mutateAsync({ schoolId, title: file.name, content: text, classId });
        documentId = res.document_id;
        await waitForEmbedded(documentId);
      }
      if (!documentId) { toast.error("Pick a source document"); setBusy(false); return; }

      setStatus("Generating questions…");
      const r = await preview.mutateAsync({
        schoolId, classId, documentId,
        topic: topic.trim(), difficulty,
        typeCounts: counts,
      });
      setPreviewQs(r.questions);
      setPreviewDocId(documentId);
      setPreviewOpen(true);
    } catch (e) {
      toast.error((e as Error).message || "Generation failed");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  const typeRow = (key: "mcq" | "tf" | "short", label: string) => (
    <div className="flex items-center justify-between gap-2 p-2 rounded-md border bg-background/50">
      <span className="text-sm">{label}</span>
      <Input
        type="number" min={0} max={20} className="w-20 h-8"
        value={counts[key]}
        onChange={(e) => setCounts((p) => ({ ...p, [key]: Math.max(0, Math.min(20, Number(e.target.value) || 0)) }))}
      />
    </div>
  );

  return (
    <>
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
          <div className="sm:col-span-2">
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
          <Label>Questions per type</Label>
          <div className="grid sm:grid-cols-3 gap-2 mt-1">
            {typeRow("mcq", "Multiple choice")}
            {typeRow("tf", "True / false")}
            {typeRow("short", "Short answer")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total: <strong>{totalCount}</strong> question{totalCount === 1 ? "" : "s"}. Set any count to 0 to skip that type.
          </p>
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
          {busy ? (status || "Working…") : "Preview quiz"}
        </Button>
      </Card>

      {previewOpen && (
        <QuizPreviewDialog
          schoolId={schoolId}
          classId={classId}
          documentId={previewDocId}
          title={aiTitle.trim()}
          topic={topic.trim()}
          difficulty={difficulty}
          initialQuestions={previewQs}
          onClose={() => setPreviewOpen(false)}
          onSaved={() => {
            setPreviewOpen(false);
            setAiTitle(""); setTopic(""); setFile(null);
          }}
        />
      )}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Preview / edit dialog — shown after AI generates, before the quiz is saved.
// Teachers can drag to reorder, edit prompts/options, regenerate a single
// question with AI, tweak marks (total updates live), and export a printable
// worksheet PDF.
// ───────────────────────────────────────────────────────────────────────────
function QuizPreviewDialog({
  schoolId, classId, documentId, title, topic, difficulty,
  initialQuestions, onClose, onSaved,
}: {
  schoolId: string; classId: string; documentId: string;
  title: string; topic: string; difficulty: string;
  initialQuestions: GeneratedQuizQuestion[];
  onClose: () => void; onSaved: () => void;
}) {
  const [items, setItems] = useState<GeneratedQuizQuestion[]>(() => initialQuestions.map((q) => ({ ...q, options: q.options ? [...q.options] : null })));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const save = useSaveSchoolQuizFromPreview();
  const regen = useRegenerateSchoolQuizQuestion();

  function update(i: number, patch: Partial<GeneratedQuizQuestion>) {
    setItems((arr) => arr.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function move(i: number, dir: -1 | 1) {
    setItems((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = arr.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function reorder(from: number, to: number) {
    if (from === to) return;
    setItems((arr) => {
      const next = arr.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }
  function remove(i: number) {
    setItems((arr) => arr.filter((_, idx) => idx !== i));
  }
  function updateOption(i: number, optIdx: number, value: string) {
    setItems((arr) => arr.map((q, idx) => {
      if (idx !== i || !q.options) return q;
      const opts = q.options.slice();
      const prev = opts[optIdx];
      opts[optIdx] = value;
      const answer = q.answer === prev ? value : q.answer;
      return { ...q, options: opts, answer };
    }));
  }

  async function regenerateOne(i: number) {
    const q = items[i];
    setRegenIdx(i);
    try {
      const others = items.filter((_, idx) => idx !== i).map((x) => x.prompt);
      const r = await regen.mutateAsync({
        schoolId, classId, documentId,
        topic, difficulty, type: q.type,
        avoidPrompts: others.concat(q.prompt),
      });
      const fresh = r.questions?.[0];
      if (!fresh) { toast.error("AI did not return a replacement"); return; }
      setItems((arr) => arr.map((cur, idx) => idx === i
        ? { ...fresh, marks: cur.marks, options: fresh.options ? [...fresh.options] : null }
        : cur));
      toast.success(`Question ${i + 1} regenerated`);
    } catch (e) {
      toast.error((e as Error).message || "Regenerate failed");
    } finally {
      setRegenIdx(null);
    }
  }

  async function doSave(status: "draft" | "published") {
    if (items.length === 0) { toast.error("Add at least one question"); return; }
    if (!title) { toast.error("Quiz title is required"); return; }
    for (let i = 0; i < items.length; i++) {
      const q = items[i];
      if (!q.prompt.trim()) { toast.error(`Question ${i + 1} needs a prompt`); return; }
      if (q.type === "mcq") {
        const opts = (q.options ?? []).filter((o) => o.trim());
        if (opts.length < 2) { toast.error(`Question ${i + 1} needs at least 2 options`); return; }
        if (!opts.includes(String(q.answer))) { toast.error(`Question ${i + 1}: pick a correct option`); return; }
      }
    }
    try {
      const r = await save.mutateAsync({
        schoolId, classId, documentId, title, status, questions: items,
      });
      toast.success(`Quiz ${r.status === "draft" ? "saved as draft" : "published"} — ${r.count} questions`);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message || "Save failed");
    }
  }

  function exportPdf() {
    if (items.length === 0) { toast.error("Nothing to export"); return; }
    import("jspdf").then(({ jsPDF }) => {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 48;
      const maxW = pageW - margin * 2;
      let y = margin;

      const ensureRoom = (h: number) => {
        if (y + h > pageH - margin) { doc.addPage(); y = margin; }
      };
      const text = (str: string, size = 11, bold = false, indent = 0) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(size);
        const lines = doc.splitTextToSize(str, maxW - indent) as string[];
        for (const ln of lines) {
          ensureRoom(size + 4);
          doc.text(ln, margin + indent, y);
          y += size + 4;
        }
      };

      text(title || "Quiz worksheet", 18, true);
      text(`Topic: ${topic || "—"}  ·  Difficulty: ${difficulty}  ·  Total marks: ${totalMarks}`, 10);
      y += 8;

      items.forEach((q, i) => {
        ensureRoom(40);
        const typeLabel = q.type === "mcq" ? "MCQ" : q.type === "tf" ? "True/False" : "Short answer";
        text(`Q${i + 1}. [${typeLabel} · ${q.marks} mark${q.marks === 1 ? "" : "s"}] ${q.prompt}`, 11, true);
        if (q.type === "mcq" && q.options) {
          q.options.forEach((opt, oi) => {
            text(`${String.fromCharCode(65 + oi)}. ${opt}`, 11, false, 18);
          });
        } else if (q.type === "tf") {
          text("☐ True    ☐ False", 11, false, 18);
        } else {
          // short / long answer: leave writing lines
          for (let k = 0; k < 4; k++) {
            ensureRoom(20);
            doc.setDrawColor(180);
            doc.line(margin + 18, y + 4, pageW - margin, y + 4);
            y += 18;
          }
        }
        y += 6;
      });

      // Answer key
      doc.addPage();
      y = margin;
      text("Answer key", 16, true);
      y += 4;
      items.forEach((q, i) => {
        let ans = "";
        if (q.type === "mcq" && q.options) {
          const idx = q.options.findIndex((o) => o === q.answer);
          ans = idx >= 0 ? `${String.fromCharCode(65 + idx)}. ${q.answer}` : String(q.answer);
        } else if (q.type === "tf") {
          ans = q.answer ? "True" : "False";
        } else {
          ans = String(q.answer ?? "");
        }
        text(`Q${i + 1}. ${ans}`, 11, false);
      });

      const safeTitle = (title || "quiz").replace(/[^a-z0-9-_]+/gi, "_");
      doc.save(`${safeTitle}_worksheet.pdf`);
    }).catch((e) => toast.error(e.message || "PDF export failed"));
  }

  const counts = items.reduce(
    (acc, q) => { acc[q.type] = (acc[q.type] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );
  const totalMarks = items.reduce((s, q) => s + (Number(q.marks) || 0), 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Preview quiz — {title || "Untitled"}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Difficulty: <strong className="capitalize">{difficulty}</strong> · {items.length} question{items.length === 1 ? "" : "s"}
            {" · "}{counts.mcq ?? 0} MCQ · {counts.tf ?? 0} T/F · {counts.short ?? 0} short
            {" · "}<strong>Total: {totalMarks} mark{totalMarks === 1 ? "" : "s"}</strong>
          </p>
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="outline" onClick={exportPdf}>
              <FileText className="h-4 w-4 mr-1" /> Export PDF worksheet
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-3 overflow-auto pr-1 flex-1">
          {items.map((q, i) => {
            const isOver = overIndex === i && dragIndex !== null && dragIndex !== i;
            return (
            <Card
              key={i}
              className={`p-3 space-y-2 transition-colors ${isOver ? "ring-2 ring-primary" : ""} ${dragIndex === i ? "opacity-50" : ""}`}
              draggable
              onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { e.preventDefault(); setOverIndex(i); }}
              onDragLeave={() => setOverIndex((cur) => (cur === i ? null : cur))}
              onDrop={(e) => { e.preventDefault(); if (dragIndex !== null) reorder(dragIndex, i); setDragIndex(null); setOverIndex(null); }}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <span className="cursor-grab select-none text-base leading-none" title="Drag to reorder">⋮⋮</span>
                  {i + 1}. {q.type === "mcq" ? "Multiple choice" : q.type === "tf" ? "True / false" : "Short answer"}
                  {q.difficulty && <span className="ml-1 capitalize">· {q.difficulty}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => regenerateOne(i)} disabled={regenIdx !== null} aria-label="Regenerate with AI" title="Regenerate this question">
                    {regenIdx === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</Button>
                  <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">↓</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(i)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              <div>
                <Label className="text-xs">Prompt</Label>
                <Textarea rows={2} value={q.prompt} onChange={(e) => update(i, { prompt: e.target.value })} />
              </div>

              {q.type === "mcq" && q.options && (
                <div className="space-y-1">
                  <Label className="text-xs">Options — tick the correct one</Label>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`answer-${i}`}
                        checked={q.answer === opt}
                        onChange={() => update(i, { answer: opt })}
                        aria-label={`Mark option ${oi + 1} as correct`}
                      />
                      <Input value={opt} onChange={(e) => updateOption(i, oi, e.target.value)} />
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">Answer key is locked to one of the options above.</p>
                </div>
              )}

              {q.type === "tf" && (
                <div>
                  <Label className="text-xs">Correct answer</Label>
                  <Select value={String(q.answer)} onValueChange={(v) => update(i, { answer: v === "true" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">Answer key is locked to True or False.</p>
                </div>
              )}

              {q.type === "short" && (
                <div>
                  <Label className="text-xs">Reference answer (editable)</Label>
                  <Textarea rows={2} value={String(q.answer ?? "")} onChange={(e) => update(i, { answer: e.target.value })} />
                </div>
              )}

              <div className="flex items-center gap-2">
                <Label className="text-xs">Marks</Label>
                <Input
                  type="number" min={1} max={20} className="w-20 h-8"
                  value={q.marks}
                  onChange={(e) => update(i, { marks: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
            </Card>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button variant="outline" onClick={() => doSave("draft")} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save as draft
          </Button>
          <Button onClick={() => doSave("published")} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Publish quiz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
