import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Play, RefreshCw } from "lucide-react";
import CurriculumImportPanel from "@/components/admin/CurriculumImportPanel";
import TemplateVerificationPanel from "@/components/admin/TemplateVerificationPanel";


interface TemplateRow {
  curriculum: string;
  grade: string;
  subject: string;
  source: string;
  verified_at: string | null;
}

interface Job {
  id: string;
  kind: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  details: any[];
  started_at: string;
  finished_at: string | null;
  error: string | null;
}

export default function CurriculumTemplates() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: jobData }, { data: tplData }] = await Promise.all([
      supabase.from("seeding_jobs").select("*").order("started_at", { ascending: false }).limit(10),
      supabase
        .from("curriculum_topic_templates")
        .select("curriculum,grade,subject,source,verified_at")
        .order("curriculum")
        .order("grade")
        .order("subject"),
    ]);
    setJobs((jobData ?? []) as unknown as Job[]);
    setTemplates((tplData ?? []) as TemplateRow[]);
    setLoading(false);
  };

  const templateCount = templates.length;
  const verifiedCount = templates.filter((t) => t.source === "verified").length;

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, []);

  const startSeed = async (force = false) => {
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-seed-curriculum", {
        body: { force, concurrency: 3 },
      });
      if (error) throw error;
      toast.success(`Seeding started: ${data?.total ?? "?"} combinations queued`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start seeding");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Curriculum Topic Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bulk-seed canonical topic trees for every (curriculum, grade, subject). Learners copy
          from these templates instead of triggering AI per signup.
        </p>
      </div>

      <Card className="p-6 flex items-center justify-between">
        <div className="flex gap-8">
          <div>
            <p className="text-sm text-muted-foreground">Templates in database</p>
            <p className="text-3xl font-bold">{templateCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Human-verified</p>
            <p className="text-3xl font-bold text-emerald-600">{verifiedCount}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => startSeed(false)} disabled={starting}>
            {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Seed Missing
          </Button>
          <Button variant="outline" onClick={() => startSeed(true)} disabled={starting}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Re-seed All
          </Button>
        </div>
      </Card>

      <CurriculumImportPanel onImported={load} />

      <TemplateVerificationPanel onChanged={load} />


      <div>
        <h2 className="text-lg font-semibold mb-3">Coverage</h2>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates yet.</p>
        ) : (
          <div className="space-y-4">
            {[...new Set(templates.map((t) => t.curriculum))].map((cur) => {
              const rows = templates.filter((t) => t.curriculum === cur);
              return (
                <Card key={cur} className="p-4">
                  <p className="font-semibold mb-2">
                    {cur}{" "}
                    <span className="text-xs text-muted-foreground font-normal">
                      {rows.filter((r) => r.source === "verified").length}/{rows.length} verified
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rows.map((r) => (
                      <Badge
                        key={`${r.grade}-${r.subject}`}
                        variant={r.source === "verified" ? "default" : "secondary"}
                        title={r.source === "verified" ? `Verified ${r.verified_at ? new Date(r.verified_at).toLocaleDateString() : ""}` : `Source: ${r.source}`}
                      >
                        {r.grade} · {r.subject}
                      </Badge>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Jobs</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((j) => {
              const done = j.succeeded + j.failed + j.skipped;
              const pct = j.total > 0 ? Math.round((done / j.total) * 100) : 0;
              return (
                <Card key={j.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        j.status === "done" ? "default" :
                        j.status === "failed" ? "destructive" : "secondary"
                      }>
                        {j.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(j.started_at).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-sm font-mono">{done}/{j.total} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>✓ {j.succeeded} succeeded</span>
                    <span>↷ {j.skipped} skipped</span>
                    <span className={j.failed > 0 ? "text-destructive" : ""}>✗ {j.failed} failed</span>
                  </div>
                  {j.failed > 0 && j.details?.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer">Show failed combos</summary>
                      <pre className="text-xs mt-2 max-h-40 overflow-auto bg-muted p-2 rounded">
                        {JSON.stringify(j.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
