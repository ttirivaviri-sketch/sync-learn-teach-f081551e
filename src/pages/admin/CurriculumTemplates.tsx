import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Play, RefreshCw } from "lucide-react";

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
  const [templateCount, setTemplateCount] = useState(0);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: jobData }, { count }] = await Promise.all([
      supabase.from("seeding_jobs").select("*").order("started_at", { ascending: false }).limit(10),
      supabase.from("curriculum_topic_templates").select("*", { count: "exact", head: true }),
    ]);
    setJobs((jobData ?? []) as any);
    setTemplateCount(count ?? 0);
    setLoading(false);
  };

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
        <div>
          <p className="text-sm text-muted-foreground">Templates in database</p>
          <p className="text-3xl font-bold">{templateCount}</p>
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
