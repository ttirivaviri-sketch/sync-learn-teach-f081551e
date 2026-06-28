/**
 * AiHomeworkPanel — teachers can generate AI homework from an ingested
 * document, review/edit it as a draft, then publish with a due date.
 * Lives inside the Homework tab of TeacherClassDetail.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Pencil, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  useTeacherSchoolDocuments, useGenerateHomework, useAiHomeworkForClass,
} from "@/hooks/useSchoolStudyMode";
import { AiHomeworkEditor } from "./AiHomeworkEditor";

export function AiHomeworkPanel({ schoolId, classId }: { schoolId: string; classId: string }) {
  const docs = useTeacherSchoolDocuments(schoolId);
  const list = useAiHomeworkForClass(classId);
  const gen = useGenerateHomework();

  const [docId, setDocId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [count, setCount] = useState("5");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [openId, setOpenId] = useState<string | null>(null);
  const [queue, setQueue] = useState<Array<{ topic: string; alertId?: string }>>([]);
  const [activeAlertId, setActiveAlertId] = useState<string | undefined>(undefined);
  const generatorRef = useRef<HTMLDivElement | null>(null);

  // Kernel-driven remediation: ClassKernelPanel / KernelAlertsPanel dispatch
  // this event. Detail can be { topic } for a single prefill, or { topics }
  // for a bulk queue. We surface the first topic in the form and queue the
  // rest as chips so the teacher can step through them.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ topic?: string; topics?: string[]; alertId?: string }>).detail || {};
      const topics = detail.topics?.length ? detail.topics : detail.topic ? [detail.topic] : [];
      if (!topics.length) return;
      const [first, ...rest] = topics;
      setTitle(`Remediation: ${first}`);
      setActiveAlertId(detail.alertId);
      setQueue(rest.map((t) => ({ topic: t })));
      const msg = topics.length === 1
        ? `Prefilled remediation for "${first}" — pick a source document and generate.`
        : `Queued ${topics.length} remediation topics. Generating "${first}" first.`;
      toast.message(msg);
      generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("los:prefill-homework", handler as EventListener);
    return () => window.removeEventListener("los:prefill-homework", handler as EventListener);
  }, []);

  const openRow = (list.data ?? []).find((h: any) => h.id === openId);

  const advanceQueue = () => {
    setQueue((q) => {
      if (q.length === 0) { setTitle(""); setActiveAlertId(undefined); return q; }
      const [next, ...rest] = q;
      setTitle(`Remediation: ${next.topic}`);
      setActiveAlertId(next.alertId);
      return rest;
    });
  };

  const handleGenerate = async () => {
    if (!docId) return toast.error("Pick a source document");
    if (!title.trim()) return toast.error("Title required");
    const isRemediation = title.startsWith("Remediation: ");
    const remediationTopic = isRemediation ? title.replace(/^Remediation:\s*/, "") : undefined;
    try {
      const res = await gen.mutateAsync({
        schoolId, classId, documentId: docId, title: title.trim(),
        difficulty, count: Number(count) || 5, asDraft: true,
        isRemediation, remediationTopic, kernelAlertId: activeAlertId,
      });
      toast.success(`Generated ${res.count} questions — review before publishing`);
      setOpenId(res.homework_id);
      advanceQueue();
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    }
  };

  return (
    <div className="space-y-3" ref={generatorRef}>
      <Card className="p-4 space-y-2 border-primary/30 bg-primary/5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Generate AI homework</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <Label>Source document</Label>
            <Select value={docId} onValueChange={setDocId}>
              <SelectTrigger><SelectValue placeholder={docs.isLoading ? "Loading…" : "Pick a document"} /></SelectTrigger>
              <SelectContent>
                {(docs.data ?? []).map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Photosynthesis homework" />
          </div>
          <div>
            <Label># questions</Label>
            <Input type="number" min={3} max={15} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div>
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleGenerate} disabled={gen.isPending}>
            {gen.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Generate draft
          </Button>
        </div>
        {(docs.data ?? []).length === 0 && !docs.isLoading && (
          <p className="text-xs text-muted-foreground">
            No ingested documents yet. Upload teaching material in the school's Academic Library to use AI homework.
          </p>
        )}
      </Card>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">AI homework</h4>
        {list.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {(list.data ?? []).length === 0 && !list.isLoading && (
          <p className="text-sm text-muted-foreground">No AI homework yet.</p>
        )}
        {(list.data ?? []).map((h: any) => (
          <Card key={h.id} className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate flex items-center gap-2">
                {h.title}
                <Badge variant={h.status === "published" ? "default" : "secondary"} className="text-[10px]">
                  {h.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {h.due_at ? `Due ${new Date(h.due_at).toLocaleString()}` : "No due date"} · {Number(h.total_marks || 0)} mk
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setOpenId(h.id)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                {h.status === "draft" ? "Review & release" : "Edit"}
              </Button>
              {h.status === "published" && (
                <Button size="sm" variant="ghost" asChild>
                  <Link to={`/school/${schoolId}/homework-review`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {openId && openRow && (
        <AiHomeworkEditor
          homeworkId={openId}
          classId={classId}
          initialDueAt={openRow.due_at}
          initialStatus={openRow.status}
          initialTitle={openRow.title}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
