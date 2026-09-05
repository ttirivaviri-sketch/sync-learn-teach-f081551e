import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ShieldCheck, RefreshCw } from "lucide-react";

interface VerifyRow {
  curriculum: string;
  grade: string;
  subject: string;
  verification_status: string | null;
  coverage_score: number | null;
  verified_against: string | null;
  last_verification_at: string | null;
  verification_report: any;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  verified: "default",
  needs_review: "destructive",
  no_source: "outline",
  unverified: "secondary",
};

export default function TemplateVerificationPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<VerifyRow[]>([]);
  const [starting, setStarting] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("curriculum_topic_templates")
      .select(
        "curriculum,grade,subject,verification_status,coverage_score,verified_against,last_verification_at,verification_report",
      )
      .order("curriculum")
      .order("grade")
      .order("subject");
    setRows((data ?? []) as unknown as VerifyRow[]);
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  const start = async (force: boolean) => {
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-curriculum-templates", {
        body: { force, limit: 10 },
      });
      if (error) throw error;
      if (data?.status === "complete") {
        toast.success("Nothing left to verify");
      } else {
        toast.success(`Verification started: ${data?.total ?? "?"} templates in this batch`);
      }
      load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to start verification");
    } finally {
      setStarting(false);
    }
  };

  const count = (s: string) =>
    rows.filter((r) => (r.verification_status ?? "unverified") === s).length;

  const reviewed = rows.filter(
    (r) => r.verification_status && r.verification_status !== "unverified",
  );

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Syllabus verification</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Audits each topic tree against the official syllabus documents and records a coverage
            score, missing and extra topics, plus reviewer notes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => start(false)} disabled={starting}>
            {starting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4 mr-2" />
            )}
            Verify unchecked
          </Button>
          <Button variant="outline" onClick={() => start(true)} disabled={starting}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Re-verify all
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        {[
          { key: "verified", label: "Verified", cls: "text-emerald-600" },
          { key: "needs_review", label: "Needs review", cls: "text-destructive" },
          { key: "no_source", label: "No syllabus found", cls: "" },
          { key: "unverified", label: "Not checked", cls: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.key}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.cls}`}>{count(s.key)}</p>
          </div>
        ))}
      </div>

      {reviewed.length > 0 && (
        <div className="space-y-2">
          {reviewed.map((r) => {
            const rep = r.verification_report ?? {};
            const missing: string[] = rep.missing_topics ?? [];
            const extra: string[] = rep.extra_topics ?? [];
            return (
              <details
                key={`${r.curriculum}-${r.grade}-${r.subject}`}
                className="rounded-md border p-3"
              >
                <summary className="cursor-pointer text-sm flex items-center gap-2 flex-wrap">
                  <Badge variant={STATUS_VARIANT[r.verification_status ?? "unverified"]}>
                    {r.verification_status}
                  </Badge>
                  <span className="font-medium">
                    {r.curriculum} · {r.grade} · {r.subject}
                  </span>
                  {r.coverage_score != null && (
                    <span className="text-muted-foreground">{r.coverage_score}% coverage</span>
                  )}
                </summary>
                <div className="mt-2 space-y-2 text-xs">
                  {r.verified_against && (
                    <p className="text-muted-foreground">Checked against: {r.verified_against}</p>
                  )}
                  {rep.notes && <p>{rep.notes}</p>}
                  {missing.length > 0 && (
                    <p>
                      <span className="font-semibold">Missing:</span> {missing.join(", ")}
                    </p>
                  )}
                  {extra.length > 0 && (
                    <p>
                      <span className="font-semibold">Not on this syllabus:</span> {extra.join(", ")}
                    </p>
                  )}
                  {r.last_verification_at && (
                    <p className="text-muted-foreground">
                      Last checked {new Date(r.last_verification_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </Card>
  );
}
