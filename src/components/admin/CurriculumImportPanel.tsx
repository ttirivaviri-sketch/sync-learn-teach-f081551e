import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, FileUp, Loader2, ShieldAlert, Upload } from "lucide-react";
import {
  parseCurriculumImport,
  summarizeTemplate,
  type CurriculumTemplateImport,
} from "@/lib/curriculumImport";

interface ExistingRow {
  curriculum: string;
  grade: string;
  subject: string;
  source: string;
}

type ComboStatus = "new" | "upgrade" | "overwrite-verified";

function comboKey(t: { curriculum: string; grade: string; subject: string }) {
  return `${t.curriculum}|${t.grade.toLowerCase()}|${t.subject.toLowerCase()}`;
}

const EXAMPLE = `{
  "curriculum": "ZIMSEC",
  "grade": "Form 4",
  "subject": "Combined Science",
  "topics": [
    {
      "name": "Energy",
      "subtopics": ["Forms of energy", "Energy transfer"],
      "learning_objectives": ["Describe energy transformations in everyday devices"],
      "key_concepts": ["conservation of energy"],
      "assessment_objectives": ["AO1: recall energy forms"],
      "typical_question_styles": ["short structured 3-mark"],
      "exam_weight": 10,
      "prerequisites": [],
      "common_misconceptions": ["energy is used up rather than transformed"],
      "exemplar_question_stems": ["State the energy change in a torch."]
    }
  ]
}`;

export default function CurriculumImportPanel({ onImported }: { onImported?: () => void }) {
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, ComboStatus> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseCurriculumImport(text), [text]);
  const canCheck = text.trim().length > 0 && parsed.issues.length === 0 && parsed.templates.length > 0;
  const overwrites = statuses
    ? Object.values(statuses).filter((s) => s === "overwrite-verified").length
    : 0;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setText(await f.text());
    setStatuses(null);
  };

  const check = async () => {
    setChecking(true);
    try {
      const next: Record<string, ComboStatus> = {};
      const { data, error } = await supabase
        .from("curriculum_topic_templates")
        .select("curriculum,grade,subject,source");
      if (error) throw error;
      const existing = new Map<string, ExistingRow>(
        ((data ?? []) as ExistingRow[]).map((r) => [comboKey(r), r]),
      );
      for (const t of parsed.templates) {
        const hit = existing.get(comboKey(t));
        next[comboKey(t)] = !hit
          ? "new"
          : hit.source === "verified"
            ? "overwrite-verified"
            : "upgrade";
      }
      setStatuses(next);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to check existing templates");
    } finally {
      setChecking(false);
    }
  };

  const runImport = async () => {
    if (!statuses) return;
    setImporting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;
      let ok = 0;
      const failed: string[] = [];
      for (const t of parsed.templates) {
        const { error } = await supabase.from("curriculum_topic_templates").upsert(
          {
            curriculum: t.curriculum,
            grade: t.grade,
            subject: t.subject,
            topics: t.topics as unknown as import("@/integrations/supabase/types").Json,
            source: "verified",
            verified_by: userId,
            verified_at: new Date().toISOString(),
          },
          { onConflict: "curriculum,grade,subject" },
        );
        if (error) failed.push(`${t.curriculum}/${t.grade}/${t.subject}: ${error.message}`);
        else ok++;
      }
      if (failed.length) {
        toast.error(`${ok} imported, ${failed.length} failed`, {
          description: failed.slice(0, 3).join("\n"),
        });
      } else {
        toast.success(`${ok} verified template${ok === 1 ? "" : "s"} imported`);
        setText("");
        setStatuses(null);
        onImported?.();
      }
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">Import verified topic trees</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Paste or upload JSON — a single template, an array, or{" "}
              <code className="text-xs">{"{ templates: [...] }"}</code>. Everything is
              validated before any write; imported rows are stored as{" "}
              <Badge variant="outline" className="align-middle">verified</Badge> and become the
              ground truth for quizzes, topic sessions, flashcards and mock papers.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp className="w-4 h-4 mr-2" /> Upload .json
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setText(EXAMPLE); setStatuses(null); }}
            >
              Load example
            </Button>
          </div>
        </div>

        <Textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setStatuses(null); }}
          placeholder='{"curriculum":"ZIMSEC","grade":"Form 4","subject":"…","topics":[…]}'
          className="font-mono text-xs min-h-[220px]"
        />

        {text.trim().length > 0 && parsed.issues.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1">
            <p className="text-sm font-medium text-destructive flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> {parsed.issues.length} validation issue
              {parsed.issues.length === 1 ? "" : "s"} — fix before importing
            </p>
            <ul className="text-xs text-destructive/90 space-y-0.5 max-h-32 overflow-auto">
              {parsed.issues.slice(0, 20).map((i, idx) => (
                <li key={idx}>
                  <span className="font-mono">{i.path}</span>: {i.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {canCheck && (
          <div className="space-y-3">
            <div className="space-y-2">
              {parsed.templates.map((t) => (
                <TemplateRow key={comboKey(t)} t={t} status={statuses?.[comboKey(t)]} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {!statuses ? (
                <Button onClick={check} disabled={checking}>
                  {checking
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Check against database
                </Button>
              ) : (
                <>
                  <Button onClick={runImport} disabled={importing} variant={overwrites > 0 ? "destructive" : "default"}>
                    {importing
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <Upload className="w-4 h-4 mr-2" />}
                    {overwrites > 0
                      ? `Import (overwrites ${overwrites} verified)`
                      : `Import ${parsed.templates.length} template${parsed.templates.length === 1 ? "" : "s"}`}
                  </Button>
                  <Button variant="ghost" onClick={() => setStatuses(null)}>Reset</Button>
                </>
              )}
            </div>
            {overwrites > 0 && (
              <p className="text-xs text-destructive">
                Warning: {overwrites} combination{overwrites === 1 ? " is" : "s are"} already
                human-verified and will be replaced by this import.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function TemplateRow({ t, status }: { t: CurriculumTemplateImport; status?: ComboStatus }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <span className="text-sm">{summarizeTemplate(t)}</span>
      {status === "new" && <Badge>new</Badge>}
      {status === "upgrade" && <Badge variant="secondary">upgrades AI row</Badge>}
      {status === "overwrite-verified" && <Badge variant="destructive">overwrites verified</Badge>}
    </div>
  );
}
