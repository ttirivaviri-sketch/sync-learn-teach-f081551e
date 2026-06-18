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
import { Loader2, Plus, Trash2, ExternalLink, CheckCircle2, XCircle, Eye } from "lucide-react";
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
};




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
              <div className="grid gap-1">
                <Label>PDF URL (direct .pdf link or storage path)</Label>
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
                  <Input value={editing.pdf_url ?? ""} onChange={(e) => setEditing({ ...editing, pdf_url: e.target.value })} />
                  <p className="text-xs text-muted-foreground">
                    Use a direct .pdf URL (https://...). Landing pages won't render.
                  </p>
                </div>
              )}

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
