import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ExternalLink, CheckCircle2, XCircle, Eye, Upload } from "lucide-react";
import { DocumentViewerOverlay } from "@/components/library/DocumentViewerOverlay";
import type { LibraryResource } from "@/types/academicProfile";

interface Resource {
  id: string;
  title: string;
  kind: string;
  curriculum: string;
  subject: string;
  topic: string | null;
  description: string | null;
  pdf_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  grade_levels: string[];
  pages: number | null;
  view_count: number;
  paper_year: number | null;
  paper_session: string | null;
  paper_number: string | null;
  marking_scheme_url: string | null;
  rights_note: string | null;
}

const empty: Partial<Resource> = {
  title: "",
  kind: "textbook",
  curriculum: "ZIMSEC",
  subject: "",
  topic: "",
  description: "",
  pdf_url: "",
  video_url: "",
  thumbnail_url: "",
  grade_levels: [],
  paper_year: null,
  paper_session: "",
  paper_number: "",
  marking_scheme_url: "",
  rights_note: "",
};

/** Upload a PDF to the public library-pdfs bucket; returns the public URL. */
async function uploadLibraryPdf(file: File, prefix: string): Promise<string> {
  if (file.type !== "application/pdf") throw new Error("Only PDF files are accepted");
  if (file.size > 50 * 1024 * 1024) throw new Error("PDF must be under 50 MB");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
  const path = `${prefix}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from("library-pdfs")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("library-pdfs").getPublicUrl(path);
  return data.publicUrl;
}




export default function Library() {
  const [items, setItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<Resource> | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; ct: string; status: number }>>({});
  const [previewing, setPreviewing] = useState<LibraryResource | null>(null);
  const [uploading, setUploading] = useState<"paper" | "scheme" | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("library_system_resources")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setItems((data ?? []) as Resource[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((r) => {
    if (kindFilter !== "all" && r.kind !== kindFilter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const save = async () => {
    const isVideo = editing?.kind === "video";
    if (!editing?.title || !editing?.subject || !editing?.curriculum || !editing?.kind) {
      toast.error("Title, kind, curriculum and subject are required");
      return;
    }
    if (isVideo && !editing?.video_url) {
      toast.error("Video kind requires a Video URL");
      return;
    }
    if (!isVideo && !editing?.pdf_url) {
      toast.error("Non-video kinds require a PDF URL");
      return;
    }
    const isPaper = editing?.kind === "past_paper";
    if (isPaper && editing?.paper_year != null) {
      const y = Number(editing.paper_year);
      if (!Number.isInteger(y) || y < 1980 || y > 2100) {
        toast.error("Paper year must be between 1980 and 2100");
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        title: editing.title,
        kind: editing.kind,
        curriculum: editing.curriculum,
        subject: editing.subject,
        topic: editing.topic || null,
        description: editing.description || null,
        pdf_url: isVideo ? null : editing.pdf_url,
        video_url: isVideo ? editing.video_url : null,
        thumbnail_url: editing.thumbnail_url || null,
        grade_levels: editing.grade_levels ?? [],
        paper_year: isPaper ? (editing.paper_year ?? null) : null,
        paper_session: isPaper ? (editing.paper_session || null) : null,
        paper_number: isPaper ? (editing.paper_number || null) : null,
        marking_scheme_url: isPaper ? (editing.marking_scheme_url || null) : null,
        rights_note: isPaper ? (editing.rights_note || null) : null,
      };
      const { error } = editing.id
        ? await supabase.from("library_system_resources").update(payload).eq("id", editing.id)
        : await supabase.from("library_system_resources").insert(payload);
      if (error) throw error;
      toast.success(editing.id ? "Updated" : "Created");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };


  const remove = async (id: string) => {
    if (!confirm("Delete this resource?")) return;
    const { error } = await supabase.from("library_system_resources").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const testLink = async (r: Resource) => {
    const url = r.video_url || r.pdf_url;
    if (!url) return;
    setTesting(r.id);
    try {
      const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
      const ct = res.headers.get("content-type") || "";
      const expectVideo = r.kind === "video";
      const ok = res.ok && (expectVideo ? !ct.toLowerCase().includes("pdf") : ct.toLowerCase().includes("pdf"));
      setTestResults((p) => ({ ...p, [r.id]: { ok, ct, status: res.status } }));
      toast[ok ? "success" : "error"](
        ok ? "URL reachable" : `Unexpected content-type: ${ct || res.status}`,
      );
    } catch (e) {
      setTestResults((p) => ({ ...p, [r.id]: { ok: false, ct: "(blocked)", status: 0 } }));
      toast.error("Couldn't reach URL (CORS or offline). Try preview instead.");
    } finally {
      setTesting(null);
    }
  };


  const preview = (r: Resource) => {
    setPreviewing({
      id: r.id,
      title: r.title,
      author: "System",
      type: r.kind === "past_paper" ? "pastpaper" : "pdf",
      category: r.subject,
      gradeLevel: r.grade_levels?.[0] ?? "",
      summary: r.description ?? "",
      rating: 0,
      reviews: 0,
      thumbnail: r.thumbnail_url ?? "",
      isOffline: false,
      duration: "",
      pdfSource: "system",
    });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Library Resources</h1>
          <p className="text-sm text-muted-foreground">{items.length} items</p>
        </div>
        <Button onClick={() => setEditing({ ...empty })}>
          <Plus className="mr-2 h-4 w-4" /> Add resource
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            <SelectItem value="textbook">Textbook</SelectItem>
            <SelectItem value="past_paper">Past paper</SelectItem>
            <SelectItem value="syllabus">Syllabus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const t = testResults[r.id];
            return (
              <Card key={r.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.title}</span>
                      <Badge variant="secondary">{r.kind}</Badge>
                      <Badge variant="outline">{r.curriculum}</Badge>
                      {r.kind === "past_paper" && r.paper_year && (
                        <Badge className="bg-orange-500 text-white border-0">
                          {r.paper_year}{r.paper_session ? ` ${r.paper_session}` : ""}{r.paper_number ? ` · ${r.paper_number}` : ""}
                        </Badge>
                      )}
                      {r.kind === "past_paper" && r.marking_scheme_url && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300">MS ✓</Badge>
                      )}
                      {r.grade_levels?.length > 0 && (
                        <Badge variant="outline">{r.grade_levels.join(", ")}</Badge>
                      )}
                      {t && (
                        <Badge variant={t.ok ? "default" : "destructive"} className="gap-1">
                          {t.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {t.status} {t.ct}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.subject}{r.topic ? ` · ${r.topic}` : ""} · {r.view_count} views
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {r.video_url || r.pdf_url}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => testLink(r)} disabled={testing === r.id}>
                      {testing === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => preview(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={r.video_url || r.pdf_url || "#"} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>

                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No resources match.</p>
          )}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit resource" : "Add resource"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label>Title</Label>
                <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1">
                  <Label>Kind</Label>
                  <Select value={editing.kind ?? "textbook"} onValueChange={(v) => setEditing({ ...editing, kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="textbook">textbook</SelectItem>
                      <SelectItem value="past_paper">past_paper</SelectItem>
                      <SelectItem value="syllabus">syllabus</SelectItem>
                      <SelectItem value="guide">guide</SelectItem>
                      <SelectItem value="video">video (clip)</SelectItem>
                    </SelectContent>
                  </Select>

                </div>
                <div className="grid gap-1">
                  <Label>Curriculum</Label>
                  <Input value={editing.curriculum ?? ""} onChange={(e) => setEditing({ ...editing, curriculum: e.target.value })} />
                </div>
                <div className="grid gap-1">
                  <Label>Subject</Label>
                  <Input value={editing.subject ?? ""} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label>Topic</Label>
                  <Input value={editing.topic ?? ""} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} />
                </div>
                <div className="grid gap-1">
                  <Label>Grade levels (comma-separated)</Label>
                  <Input
                    value={(editing.grade_levels ?? []).join(", ")}
                    onChange={(e) => setEditing({
                      ...editing,
                      grade_levels: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })}
                  />
                </div>
              </div>
              {editing.kind === "video" ? (
                <div className="grid gap-1">
                  <Label>Video URL (YouTube, Vimeo, Loom, or direct .mp4)</Label>
                  <Input value={editing.video_url ?? ""} onChange={(e) => setEditing({ ...editing, video_url: e.target.value })} />
                  <p className="text-xs text-muted-foreground">
                    Videos surface in the Clips tab. Paste a YouTube/Vimeo/Loom URL or a direct video file URL.
                  </p>
                </div>
              ) : (
                <div className="grid gap-1">
                  <Label>PDF URL (direct .pdf link or storage path)</Label>
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
                      value={editing.pdf_url ?? ""}
                      onChange={(e) => setEditing({ ...editing, pdf_url: e.target.value })}
                    />
                    <Button variant="outline" size="sm" className="shrink-0" asChild disabled={uploading === "paper"}>
                      <label className="cursor-pointer">
                        {uploading === "paper"
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><Upload className="h-4 w-4 mr-1" /> Upload</>}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (!f) return;
                            setUploading("paper");
                            try {
                              const url = await uploadLibraryPdf(f, editing.kind === "past_paper" ? "past-papers" : "resources");
                              setEditing((prev) => prev ? { ...prev, pdf_url: url } : prev);
                              toast.success("PDF uploaded");
                            } catch (err: any) {
                              toast.error(err.message ?? "Upload failed");
                            } finally {
                              setUploading(null);
                            }
                          }}
                        />
                      </label>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Paste a direct .pdf URL, or upload straight to storage. Landing pages won't render.
                  </p>
                </div>
              )}

              {editing.kind === "past_paper" && (
                <div className="rounded-lg border bg-muted/30 p-3 grid gap-3">
                  <p className="text-xs font-medium text-muted-foreground">Past-paper details</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="grid gap-1">
                      <Label>Year</Label>
                      <Input
                        type="number"
                        min={1980}
                        max={2100}
                        value={editing.paper_year ?? ""}
                        onChange={(e) => setEditing({ ...editing, paper_year: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label>Session</Label>
                      <Select
                        value={editing.paper_session || "none"}
                        onValueChange={(v) => setEditing({ ...editing, paper_session: v === "none" ? "" : v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          <SelectItem value="March">March</SelectItem>
                          <SelectItem value="June">June</SelectItem>
                          <SelectItem value="November">November</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label>Paper</Label>
                      <Input
                        placeholder="Paper 1"
                        value={editing.paper_number ?? ""}
                        onChange={(e) => setEditing({ ...editing, paper_number: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label>Marking scheme URL (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        className="flex-1"
                        value={editing.marking_scheme_url ?? ""}
                        onChange={(e) => setEditing({ ...editing, marking_scheme_url: e.target.value })}
                      />
                      <Button variant="outline" size="sm" className="shrink-0" asChild disabled={uploading === "scheme"}>
                        <label className="cursor-pointer">
                          {uploading === "scheme"
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <><Upload className="h-4 w-4 mr-1" /> Upload</>}
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              if (!f) return;
                              setUploading("scheme");
                              try {
                                const url = await uploadLibraryPdf(f, "marking-schemes");
                                setEditing((prev) => prev ? { ...prev, marking_scheme_url: url } : prev);
                                toast.success("Marking scheme uploaded");
                              } catch (err: any) {
                                toast.error(err.message ?? "Upload failed");
                              } finally {
                                setUploading(null);
                              }
                            }}
                          />
                        </label>
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label>Rights / provenance note (admin-only)</Label>
                    <Input
                      placeholder="e.g. Official ZIMSEC release, publicly distributed"
                      value={editing.rights_note ?? ""}
                      onChange={(e) => setEditing({ ...editing, rights_note: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Only upload papers you have the right to distribute. This note is never shown to learners.
                    </p>
                  </div>
                </div>
              )}
              <div className="grid gap-1">
                <Label>Thumbnail URL</Label>
                <Input value={editing.thumbnail_url ?? ""} onChange={(e) => setEditing({ ...editing, thumbnail_url: e.target.value })} />
              </div>

              <div className="grid gap-1">
                <Label>Description</Label>
                <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewing && (
        <DocumentViewerOverlay resource={previewing} onClose={() => setPreviewing(null)} />
      )}
    </div>
  );
}
