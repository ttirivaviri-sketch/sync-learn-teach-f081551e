/**
 * PaperMarkPanel — "Mark my answers" for the past-paper viewer.
 *
 * A learner viewing a past paper photographs (or uploads) their attempted
 * answers; we send the image to the existing `photo-solve-grade` edge
 * function TOGETHER with the paper's extracted text, so the AI marks the
 * work against the actual questions on the paper — examiner-style, step by
 * step: verdicts, corrections, marks, what the examiner expects, and a
 * model solution.
 *
 * Reuses the proven photo-solve engine (multimodal Gemini) — the paper
 * text rides in the `question` context field, so no edge-function changes
 * or redeploys are needed.
 *
 * After marking, "Practice this question type" hands the graded result to
 * PhotoSolvePractice, which generates 5 isomorphic variants (same method &
 * marks, new values) drilling the exact steps the student got wrong.
 */
import { useCallback, useRef, useState } from "react";
import {
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  RefreshCcw,
  Sparkles,
  ClipboardCheck,
  Target,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logger } from "@/utils/logger";
import { supabase } from "@/integrations/supabase/client";
import { aiRequestJSON } from "@/studymode/lib/aiClient";
import { MathMarkdown } from "@/studymode/components/MathMarkdown";
import type { PhotoSolveResult } from "@/studymode/components/PhotoSolvePanel";
import { PhotoSolvePractice } from "@/studymode/components/PhotoSolvePractice";
import { imageCompressionParams } from "@/lib/dataSaver";
import type { LibraryResource } from "@/types/academicProfile";

interface PaperMarkPanelProps {
  resource: LibraryResource;
  /** Lazy text extractor from the PDF viewer (null until the doc is ready). */
  getDocumentText: (() => Promise<string>) | null;
  onClose: () => void;
}

const MAX_BYTES = 12 * 1024 * 1024; // 12MB raw file cap
/** Cap on paper text sent as marking context (chars). */
const PAPER_CONTEXT_CAP = 9000;

/** Downscale & re-encode as JPEG (Data Saver aware) — mirrors PhotoSolvePanel. */
async function fileToCompressedDataUrl(file: File): Promise<string> {
  const readAsDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error || new Error("Could not read file"));
      r.readAsDataURL(f);
    });

  const original = await readAsDataUrl(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("decode failed"));
      im.src = original;
    });
    const { maxDim, quality } = imageCompressionParams();
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return original;
  }
}

type Verdict = PhotoSolveResult["steps"][number]["verdict"];

function verdictBits(v: Verdict) {
  switch (v) {
    case "correct":
      return {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
        chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
        label: "Correct",
      };
    case "partial":
      return {
        icon: <Sparkles className="h-4 w-4 text-amber-600" />,
        chip: "bg-amber-50 text-amber-700 border-amber-200",
        label: "Partial credit",
      };
    case "incorrect":
      return {
        icon: <XCircle className="h-4 w-4 text-red-600" />,
        chip: "bg-red-50 text-red-700 border-red-200",
        label: "Incorrect",
      };
    default:
      return {
        icon: <AlertTriangle className="h-4 w-4 text-slate-500" />,
        chip: "bg-slate-100 text-slate-600 border-slate-200",
        label: "Missing step",
      };
  }
}

export function PaperMarkPanel({
  resource,
  getDocumentText,
  onClose,
}: PaperMarkPanelProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"reading" | "marking" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhotoSolveResult | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [practising, setPractising] = useState(false);
  const [usingMetadataFallback, setUsingMetadataFallback] = useState(false);
  const paperTextRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const pickFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    setResult(null);
    if (file.size > MAX_BYTES) {
      setError("That photo is too large (max 12MB). Try a smaller image.");
      return;
    }
    try {
      setDataUrl(await fileToCompressedDataUrl(file));
    } catch {
      setError("Couldn't read that image. Try another photo.");
    }
  }, []);

  const subject = resource.tags?.subject || resource.category;
  const paperBits = [
    resource.paperMeta?.year,
    resource.paperMeta?.session,
    resource.paperMeta?.paperNumber,
  ].filter(Boolean);
  const paperLabel = [resource.title, paperBits.join(" ")]
    .filter(Boolean)
    .join(" — ");

  const submit = useCallback(async () => {
    if (!dataUrl || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setShowSolution(false);

    try {
      // 1) Extract the paper's text once (lazy — only pay when marking).
      if (paperTextRef.current === null && getDocumentText) {
        setPhase("reading");
        try {
          paperTextRef.current = await getDocumentText();
        } catch {
          paperTextRef.current = "";
        }
      }
      const paperText = (paperTextRef.current || "").slice(0, PAPER_CONTEXT_CAP);

      // 2) Build the marking context. The paper content rides in the
      //    `question` field — the grader treats it as the source questions.
      const question = paperText
        ? `The student is answering questions from this past exam paper: "${paperLabel}".\n` +
          `Identify WHICH question(s) from the paper the photographed work attempts, ` +
          `then mark strictly against that question's requirements and the official ` +
          `mark-allocation style for this exam. Explain what the examiner expects ` +
          `for each mark.\n\nPAPER CONTENT (may be truncated):\n${paperText}`
        : `The student is answering questions from the past exam paper "${paperLabel}". ` +
          `The paper's text could not be extracted (scanned PDF) — identify the question ` +
          `from the photo itself and mark it as an examiner for this exam would.`;

      setPhase("marking");
      const data = await aiRequestJSON<PhotoSolveResult>("photo-solve-grade", {
        image: dataUrl,
        question,
        subject,
        topic: resource.title,
        curriculum: resource.tags?.curriculum ?? undefined,
        examLevel: resource.tags?.grade ?? resource.gradeLevel ?? undefined,
      });
      setResult(data);

      // Best-effort history persistence (same table as StudyMode photo-solve)
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (uid) {
          const { data: row, error: insErr } = await supabase
            .from("photo_solve_attempts")
            .insert({
              user_id: uid,
              subject_name: subject ?? null,
              topic_name: resource.title ?? null,
              curriculum: resource.tags?.curriculum ?? null,
              question_detected: data.question_detected || null,
              final_answer: data.final_answer || null,
              final_answer_correct: data.final_answer_correct,
              steps: data.steps,
              missed_steps: data.missed_steps,
              next_hint: data.next_hint || null,
              model_solution: data.model_solution || null,
              confidence: data.confidence,
              marks_awarded: data.marks_awarded,
              marks_possible: data.marks_possible,
            } as never)
            .select("id")
            .single();
          if (insErr) logger.warn("paper-mark attempt persist failed", insErr);
          else setAttemptId((row as { id?: string } | null)?.id ?? null);
        }
      } catch (persistErr) {
        logger.warn("paper-mark attempt persistence failed:", persistErr);
      }
    } catch (err) {
      logger.error("Paper mark error:", err);
      setError(
        err instanceof Error ? err.message : "Marking failed. Please try again.",
      );
    } finally {
      setLoading(false);
      setPhase(null);
    }
  }, [dataUrl, loading, getDocumentText, paperLabel, subject, resource]);

  const reset = () => {
    setDataUrl(null);
    setResult(null);
    setError(null);
    setShowSolution(false);
    setAttemptId(null);
    setPractising(false);
  };

  // Practice is worthwhile when we know the question and its solution, and
  // there is something to fix (any non-correct step, missed step, or a wrong
  // final answer).
  const canPractise =
    !!result &&
    !!result.question_detected &&
    !!result.model_solution &&
    (result.final_answer_correct === false ||
      result.steps?.some((s) => s.verdict !== "correct") ||
      (result.missed_steps?.length ?? 0) > 0);

  const scorePct =
    result && result.marks_possible > 0
      ? Math.round((result.marks_awarded / result.marks_possible) * 100)
      : null;

  // ── Practice mode: isomorphic variants of the marked paper question ──────
  if (practising && result) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex-1 overflow-y-auto p-3">
          <PhotoSolvePractice
            original={result}
            attemptId={attemptId}
            subjectName={subject}
            topicName={resource.title}
            curriculum={resource.tags?.curriculum ?? null}
            onBack={() => setPractising(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-emerald-100 p-1.5">
            <ClipboardCheck className="h-3.5 w-3.5 text-emerald-700" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Mark my answers</p>
            <p className="max-w-[180px] truncate text-[10px] text-muted-foreground">
              against this paper
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* ── Capture stage ── */}
        {!result && (
          <>
            <p className="text-xs text-muted-foreground">
              Photograph your written attempt at any question in this paper.
              I'll identify the question, mark each step like an examiner, and
              show you what earns the marks.
            </p>

            {/* Hidden inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />

            {!dataUrl ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-6 text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  <Camera className="h-5 w-5 text-primary" />
                  Take photo
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-6 text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  <Upload className="h-5 w-5 text-primary" />
                  Upload image
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-xl border border-border">
                  <img
                    src={dataUrl}
                    alt="Your attempted answer"
                    className="max-h-56 w-full object-contain bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                    size="sm"
                    onClick={submit}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {phase === "reading" ? "Reading paper…" : "Marking…"}
                      </>
                    ) : (
                      <>
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Mark against this paper
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={reset} disabled={loading}>
                    <RefreshCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        {/* ── Results stage ── */}
        {result && (
          <div className="space-y-3">
            {/* Score card */}
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">
                  {result.marks_possible > 0
                    ? `${result.marks_awarded} / ${result.marks_possible} marks`
                    : "Marked"}
                </p>
                {scorePct !== null && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      scorePct >= 70
                        ? "bg-emerald-100 text-emerald-700"
                        : scorePct >= 40
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700",
                    )}
                  >
                    {scorePct}%
                  </span>
                )}
              </div>
              {result.question_detected && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  <MathMarkdown>{`Question identified: ${result.question_detected}`}</MathMarkdown>
                </div>
              )}
              {result.confidence < 0.5 && (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  Some of the photo was hard to read — retake in better light for a more accurate mark.
                </p>
              )}
            </div>

            {/* Step-by-step examiner feedback */}
            {result.steps?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Step-by-step marking
                </p>
                {result.steps.map((s) => {
                  const v = verdictBits(s.verdict);
                  return (
                    <div
                      key={s.index}
                      className="rounded-lg border border-border bg-background p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {v.icon}
                          <span
                            className={cn(
                              "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                              v.chip,
                            )}
                          >
                            {v.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          Step {s.index}
                        </span>
                      </div>
                      <div className="mt-1.5 text-xs text-foreground">
                        <MathMarkdown>{s.student_step}</MathMarkdown>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{s.reason}</p>
                      {s.correction && (
                        <div className="mt-1.5 rounded-md bg-emerald-50 p-2 text-[11px] text-emerald-800">
                          <MathMarkdown>{`**Correct move:** ${s.correction}`}</MathMarkdown>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Missed steps — examiner expectations */}
            {result.missed_steps?.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                <p className="text-[11px] font-semibold text-amber-800">
                  The examiner also expected:
                </p>
                <ul className="mt-1 space-y-1">
                  {result.missed_steps.map((m, i) => (
                    <li key={i} className="text-[11px] text-amber-800">
                      <MathMarkdown>{`• ${m}`}</MathMarkdown>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next hint */}
            {result.next_hint && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-primary/5 p-2.5">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="text-[11px] text-foreground">
                  <MathMarkdown>{result.next_hint}</MathMarkdown>
                </div>
              </div>
            )}

            {/* Model solution (collapsed by default) */}
            {result.model_solution && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowSolution((v) => !v)}
                >
                  {showSolution ? "Hide model solution" : "Show model solution"}
                </Button>
                {showSolution && (
                  <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">
                    <MathMarkdown>{result.model_solution}</MathMarkdown>
                  </div>
                )}
              </div>
            )}

            {canPractise && (
              <Button
                size="sm"
                className="w-full gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                onClick={() => setPractising(true)}
              >
                <Target className="h-3.5 w-3.5" />
                Practice this question type
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={reset}
            >
              <Camera className="h-3.5 w-3.5" />
              Mark another answer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
