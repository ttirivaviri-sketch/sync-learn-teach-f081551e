import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, FileText, CloudDownload } from "lucide-react";

interface SourceRow {
  id: string;
  curriculum: string;
  subject: string;
  grade: string | null;
  name: string;
  status: string;
  char_count: number;
  error: string | null;
  storage_path: string | null;
  source_url: string | null;
  fetched_at: string | null;
}

const BUCKET = "syllabus-uploads";
const CURRICULA = ["NSC", "IEB", "ZIMSEC", "CAMB"];

export default function SyllabusLibraryPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [subjectsByCurriculum, setSubjectsByCurriculum] = useState<Record<string, string[]>>({});
  const [curriculum, setCurriculum] = useState("NSC");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [docName, setDocName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [{ data: sources }, { data: templates }] = await Promise.all([
      supabase
        .from("curriculum_syllabus_sources")
        .select("id,curriculum,subject,grade,name,status,char_count,error,storage_path,source_url,fetched_at")
        .order("curriculum")
        .order("subject"),
      supabase.from("curriculum_topic_templates").select("curriculum,subject"),
    ]);
    setRows((sources ?? []) as unknown as SourceRow[]);

    const map: Record<string, Set<string>> = {};
    for (const t of (templates ?? []) as { curriculum: string; subject: string }[]) {
      (map[t.curriculum] ??= new Set()).add(t.subject);
    }
    setSubjectsByCurriculum(
      Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v].sort()])),
    );
  };

  useEffect(() => {
    load();
  }, []);

  const subjectOptions = subjectsByCurriculum[curriculum] ?? [];

  // Subjects for this curriculum that still have no readable syllabus document.
  const missing = useMemo(() => {
    const have = new Set(
      rows
        .filter((r) => r.curriculum === curriculum && r.status === "ready")
        .map((r) => r.subject.toLowerCase()),
    );
    return subjectOptions.filter((s) => !have.has(s.toLowerCase()));
  }, [rows, subjectOptions, curriculum]);

  const upload = async () => {
    if (!file) return toast.error("Choose a PDF first");
    if (!subject.trim()) return toast.error("Choose a subject");
    setBusy(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${curriculum}/${subject.replace(/[^a-zA-Z0-9]+/g, "-")}/${Date.now()}-${safe}`;
    try {
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;

      const { data, error } = await supabase.functions.invoke("ingest-syllabus-upload", {
        body: {
          path,
          curriculum,
          subject: subject.trim(),
          grade: grade.trim() || null,
          name: docName.trim() || file.name,
        },
      });
      if (error) {
        // Surface the function's own message rather than a bare non-2xx error.
        const detail = (await (error as any)?.context?.json?.().catch(() => null))?.error;
        throw new Error(detail ?? error.message);
      }
      toast.success(`Filed ${data?.chars?.toLocaleString?.() ?? "?"} characters of syllabus text`);
      setFile(null);
      setDocName("");
      if (fileRef.current) fileRef.current.value = "";
      load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: SourceRow) => {
    if (!confirm(`Remove "${row.name}" from the syllabus library?`)) return;
    if (row.storage_path) {
      await supabase.storage.from(BUCKET).remove([row.storage_path]);
    }
    const { error } = await supabase.from("curriculum_syllabus_sources").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  };

  const importCambridge = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-syllabus-sources", {
        body: { catalog: true },
      });
      if (error) throw error;
      toast.success(
        `Cambridge import: ${data?.ingested ?? 0} added, ${data?.failed ?? 0} failed`,
      );
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const grouped = useMemo(() => {
    const g: Record<string, SourceRow[]> = {};
    for (const r of rows) (g[r.curriculum] ??= []).push(r);
    return g;
  }, [rows]);

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Syllabus library</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload the official DBE / IEB subject guideline PDFs here. Verification checks topic
            trees against these documents, so a subject with no document can never pass.
          </p>
        </div>
        <Button variant="outline" onClick={importCambridge} disabled={importing}>
          {importing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <CloudDownload className="w-4 h-4 mr-2" />
          )}
          Import Cambridge set
        </Button>
      </div>

      {/* ── Upload form ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Curriculum</Label>
            <Select
              value={curriculum}
              onValueChange={(v) => {
                setCurriculum(v);
                setSubject("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRICULA.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Subject</Label>
            {subjectOptions.length > 0 ? (
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Mathematics"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>
              Grade <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 12" />
          </div>

          <div className="space-y-1.5">
            <Label>
              Document name <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="CAPS Grade 12 guideline"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="syllabus-file">PDF file</Label>
            <Input
              id="syllabus-file"
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="max-w-sm"
            />
          </div>
          <Button onClick={upload} disabled={busy || !file}>
            {busy ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Upload &amp; read
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          The PDF must contain real text — scanned page images cannot be read. Uploading the same
          curriculum, subject and document name again replaces the stored copy.
        </p>
      </div>

      {/* ── Still missing ───────────────────────────────────────────────── */}
      {missing.length > 0 && (
        <div className="text-sm">
          <p className="font-medium mb-1.5">{curriculum} subjects with no syllabus document yet</p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="cursor-pointer"
                onClick={() => setSubject(s)}
              >
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ── Stored documents ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="font-medium text-sm">
          Stored documents{" "}
          <span className="text-muted-foreground font-normal">
            ({rows.filter((r) => r.status === "ready").length} readable of {rows.length})
          </span>
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
        ) : (
          Object.entries(grouped).map(([cur, list]) => (
            <div key={cur} className="rounded-md border">
              <p className="px-3 py-2 text-sm font-semibold border-b bg-muted/40">{cur}</p>
              <ul className="divide-y">
                {list.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="font-medium">{r.subject}</span>
                        {r.grade ? ` · ${r.grade}` : ""} — {r.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.status === "ready"
                          ? `${r.char_count.toLocaleString()} characters`
                          : r.error ?? "Could not be read"}
                        {r.fetched_at ? ` · ${new Date(r.fetched_at).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <Badge variant={r.status === "ready" ? "default" : "destructive"}>
                      {r.status}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(r)}
                      aria-label={`Remove ${r.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
