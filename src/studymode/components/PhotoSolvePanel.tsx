/**
 * PhotoSolvePanel
 *
 * Lets a student snap or upload a photo of their handwritten working,
 * sends it to the `photo-solve-grade` edge function (multimodal Gemini),
 * and renders step-by-step grading with KaTeX-rendered math.
 *
 * Awards XP for correct steps and fires haptics on first-correct + on
 * a fully correct submission.
 *
 * Each grading is persisted to `photo_solve_attempts` (best-effort) and a
 * "Practice this correction" CTA generates 5 isomorphic variants of the
 * photographed question via PhotoSolvePractice.
 */

import { useCallback, useRef, useState } from 'react';
import {
  Camera, Upload, ArrowLeft, Loader2, CheckCircle2, XCircle,
  AlertTriangle, Lightbulb, RefreshCcw, Sparkles, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Subject, Topic } from '../types/study';
import { MathMarkdown } from './MathMarkdown';
import { aiRequestJSON } from '../lib/aiClient';
import { useUserProgress } from '../hooks/useUserProgress';
import { studySyncHaptic, studySyncHapticOnce } from '@/lib/haptics';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';
import { PhotoSolvePractice } from './PhotoSolvePractice';
import { PhotoSolveHistory } from './PhotoSolveHistory';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { imageCompressionParams } from '@/lib/dataSaver';

export interface PhotoSolveResult {
  question_detected: string;
  /** Subject the AI thinks the photographed work actually belongs to. */
  detected_subject?: string;
  /** Whether the work matches the subject the learner is studying. */
  subject_match?: 'match' | 'mismatch' | 'unclear';
  final_answer: string;
  final_answer_correct: boolean | null;
  steps: Array<{
    index: number;
    student_step: string;
    verdict: 'correct' | 'partial' | 'incorrect' | 'missing';
    reason: string;
    correction: string;
  }>;
  missed_steps: string[];
  next_hint: string;
  model_solution: string;
  confidence: number;
  marks_awarded: number;
  marks_possible: number;
}

interface PhotoSolvePanelProps {
  subject?: Subject;
  topic?: Topic;
  question?: string;
  totalMarks?: number;
  curriculum?: string | null;
  onBack: () => void;
  /** Called once grading succeeds — host can pull final_answer into its textarea */
  onResult?: (result: PhotoSolveResult) => void;
}

type GradedStep = PhotoSolveResult['steps'][number];

const MAX_BYTES = 12 * 1024 * 1024; // 12MB cap on the raw user file

/**
 * Downscale and re-encode as JPEG. Normal: ≤1600px @ q0.82.
 * Data Saver active: ≤1024px @ q0.6 (~3-4x smaller upload).
 */
async function fileToCompressedDataUrl(file: File): Promise<string> {
  const readAsDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error || new Error('Could not read file'));
      r.readAsDataURL(f);
    });

  const original = await readAsDataUrl(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('decode failed'));
      im.src = original;
    });
    const { maxDim, quality } = imageCompressionParams();
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return original;
  }
}

function verdictStyles(v: GradedStep['verdict']) {
  switch (v) {
    case 'correct':
      return {
        icon: <CheckCircle2 className="h-4 w-4 text-success" />,
        chip: 'bg-success/15 text-success border-success/30',
        label: 'Correct',
      };
    case 'partial':
      return {
        icon: <Sparkles className="h-4 w-4 text-warning" />,
        chip: 'bg-warning/15 text-warning border-warning/30',
        label: 'Partial',
      };
    case 'incorrect':
      return {
        icon: <XCircle className="h-4 w-4 text-destructive" />,
        chip: 'bg-destructive/15 text-destructive border-destructive/30',
        label: 'Incorrect',
      };
    case 'missing':
      return {
        icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
        chip: 'bg-muted text-muted-foreground border-border',
        label: 'Missing step',
      };
  }
}

export function PhotoSolvePanel({
  subject,
  topic,
  question,
  totalMarks,
  curriculum,
  onBack,
  onResult,
}: PhotoSolvePanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhotoSolveResult | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [practising, setPractising] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { addXp, updateStreak } = useUserProgress();

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError('Image is too large — please use one under 12MB.');
      return;
    }
    setError(null);
    setResult(null);
    try {
      const url = await fileToCompressedDataUrl(file);
      setDataUrl(url);
      setPreviewUrl(url);
    } catch (e) {
      logger.error('photo-solve read failed', e);
      setError('Could not read that image.');
    }
  };

  const submit = useCallback(async () => {
    if (!dataUrl) return;
    setLoading(true);
    setError(null);
    try {
      const data = await aiRequestJSON<PhotoSolveResult>('photo-solve-grade', {
        image: dataUrl,
        question,
        subject: subject?.name,
        topic: topic?.name,
        curriculum: curriculum ?? undefined,
        totalMarks,
      });
      setResult(data);
      onResult?.(data);

      // Subject guard: if the photographed work is clearly a different
      // subject than the one being studied, we grade it but never attribute
      // it to the current subject/topic (no XP, no mastery, no analytics).
      const mismatched = !!subject?.name && data.subject_match === 'mismatch';

      // Persist the attempt (best-effort) so it can drive follow-up practice
      // and history. Failures never block the grading UX.
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (uid) {
          const { data: row, error: insErr } = await supabase
            .from('photo_solve_attempts')
            .insert({
              user_id: uid,
              subject_name: mismatched
                ? (data.detected_subject || null)
                : (subject?.name ?? null),
              topic_name: mismatched ? null : (topic?.name ?? null),
              curriculum: curriculum ?? null,
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
            })
            .select('id')
            .single();
          if (insErr) logger.warn('photo-solve attempt persist failed', insErr);
          else setAttemptId(row?.id ?? null);
        }
      } catch (persistErr) {
        logger.warn('photo-solve attempt persist failed', persistErr);
      }

      // XP + haptics
      const correctCount = data.steps.filter((s) => s.verdict === 'correct').length;
      const allCorrect =
        data.steps.length > 0 &&
        correctCount === data.steps.length &&
        data.final_answer_correct !== false;

      if (correctCount > 0) {
        studySyncHapticOnce('quiz.correct', 'photo-solve-first-correct-step');
      }
      if (allCorrect) {
        studySyncHaptic('quiz.perfect');
      } else if (correctCount > 0) {
        studySyncHaptic('quiz.correct');
      } else {
        studySyncHaptic('quiz.wrong');
      }

      if (!mismatched) {
        const xp = Math.max(5, correctCount * 6 + (allCorrect ? 10 : 0));
        addXp.mutate(xp);
        updateStreak.mutate();
      }
    } catch (e: any) {
      logger.error('photo-solve grade failed', e);
      const msg = String(e?.message || '');
      if (msg.includes('rate_limited') || msg.includes('429')) {
        setError("You've hit today's AI limit — try again tomorrow or upgrade.");
      } else if (msg.includes('credits_exhausted') || msg.includes('402')) {
        setError('AI credits exhausted on this workspace. Please add credits.');
      } else if (msg.toLowerCase().includes('payload') || msg.includes('413')) {
        setError('Image too large after upload — try a clearer, smaller photo.');
      } else {
        setError(msg || 'Could not grade your photo. Try a clearer image.');
      }
    } finally {
      setLoading(false);
    }
  }, [dataUrl, question, subject?.name, topic?.name, curriculum, totalMarks, addXp, updateStreak, onResult]);

  const reset = () => {
    setResult(null);
    setPreviewUrl(null);
    setDataUrl(null);
    setError(null);
    setShowSolution(false);
    setAttemptId(null);
    setPractising(false);
  };

  // ── Practice mode: 5 isomorphic variants of the graded question ──────────
  if (practising && result) {
    return (
      <PhotoSolvePractice
        original={result}
        attemptId={attemptId}
        subjectName={subject?.name}
        topicName={topic?.name}
        curriculum={curriculum}
        onBack={() => setPractising(false)}
      />
    );
  }

  const subjectMismatch = !!subject?.name && result?.subject_match === 'mismatch';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-foreground">Photo Solve</h2>
          <p className="text-xs text-muted-foreground">
            Snap your working — get step-by-step examiner feedback
          </p>
        </div>
      </div>

      {/* Question context */}
      {question && (
        <div className="p-3 rounded-xl bg-muted/40 border border-border">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Question
          </p>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MathMarkdown>{question}</MathMarkdown>
          </div>
        </div>
      )}

      {/* Upload / camera buttons */}
      {!previewUrl && (
        <div className="grid grid-cols-2 gap-3">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <Button
            onClick={() => cameraRef.current?.click()}
            className="h-auto py-5 flex-col gap-2 gradient-primary"
          >
            <Camera className="h-6 w-6" />
            <span className="text-sm font-bold">Take Photo</span>
          </Button>
          <Button
            onClick={() => fileRef.current?.click()}
            variant="outline"
            className="h-auto py-5 flex-col gap-2 border-accent/30"
          >
            <Upload className="h-6 w-6 text-accent-foreground" />
            <span className="text-sm font-bold">Upload Image</span>
          </Button>
        </div>
      )}

      {/* Recent attempts — idle state only */}
      {!previewUrl && !loading && !result && <PhotoSolveHistory />}

      {/* Preview */}
      {previewUrl && (
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
            <img
              src={previewUrl}
              alt="Your working"
              className="w-full max-h-96 object-contain bg-background"
            />
          </div>
          {!result && !loading && (
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={reset} variant="outline" className="gap-2">
                <RefreshCcw className="h-4 w-4" />
                Retake
              </Button>
              <Button onClick={submit} className="gradient-primary gap-2">
                <Sparkles className="h-4 w-4" />
                Grade my working
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="p-5 rounded-xl bg-card border border-border text-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Reading your working…</p>
          <p className="text-xs text-muted-foreground">
            AI is checking each step and the final answer.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {subjectMismatch && (
            <div className="p-3 rounded-xl bg-warning/10 border border-warning/40 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs text-foreground">
                <p className="font-semibold mb-0.5">
                  This looks like {result.detected_subject || 'a different subject'}, not{' '}
                  {subject?.name}
                </p>
                <p className="text-muted-foreground">
                  We still marked your working, but it won't count towards your{' '}
                  {subject?.name} XP, topic mastery or progress. Switch to{' '}
                  {result.detected_subject || 'the right subject'} and scan again to get credit.
                </p>
              </div>
            </div>
          )}
          {/* Score header */}
          <div
            className={cn(
              'p-4 rounded-2xl border',
              result.final_answer_correct
                ? 'bg-success/10 border-success/30'
                : 'bg-warning/10 border-warning/30'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">
                {result.final_answer_correct
                  ? 'Final answer correct'
                  : 'Keep going — see the steps'}
              </span>
              <span className="px-3 py-1 rounded-full bg-background/60 text-sm font-bold">
                {result.marks_awarded} / {result.marks_possible}
              </span>
            </div>
            {result.final_answer && (
              <div className="text-sm text-foreground">
                <span className="text-muted-foreground">Your answer: </span>
                <MathMarkdown>{result.final_answer}</MathMarkdown>
              </div>
            )}
            {result.confidence < 0.5 && (
              <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Some of the handwriting was hard to read — try a clearer photo for better grading.
              </p>
            )}
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Step-by-step</h3>
            {result.steps.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No steps detected in your image.
              </p>
            )}
            {result.steps.map((s) => {
              const v = verdictStyles(s.verdict);
              return (
                <div
                  key={s.index}
                  className="p-3 rounded-xl bg-card border border-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        Step {s.index}
                      </span>
                      {v.icon}
                    </div>
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide',
                        v.chip
                      )}
                    >
                      {v.label}
                    </span>
                  </div>
                  {s.student_step && (
                    <div className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none">
                      <MathMarkdown>{s.student_step}</MathMarkdown>
                    </div>
                  )}
                  {s.reason && (
                    <p className="text-xs text-muted-foreground mt-1">{s.reason}</p>
                  )}
                  {s.correction && s.verdict !== 'correct' && (
                    <div className="mt-2 p-2 rounded-lg bg-accent/10 border border-accent/20 text-xs">
                      <span className="font-semibold text-accent-foreground">Should be: </span>
                      <span className="text-foreground">
                        <MathMarkdown>{s.correction}</MathMarkdown>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {result.missed_steps.length > 0 && (
              <div className="p-3 rounded-xl bg-muted/40 border border-dashed border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  Steps you skipped
                </p>
                <ul className="space-y-1">
                  {result.missed_steps.map((m, i) => (
                    <li key={i} className="text-sm text-foreground">
                      • <MathMarkdown>{m}</MathMarkdown>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Next hint */}
          {result.next_hint && (
            <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-accent-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-accent-foreground mb-0.5">Next hint</p>
                <div className="text-sm text-foreground">
                  <MathMarkdown>{result.next_hint}</MathMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Model solution toggle */}
          {result.model_solution && (
            <div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowSolution((v) => !v)}
              >
                {showSolution ? 'Hide' : 'Show'} full model solution
              </Button>
              {showSolution && (
                <div className="mt-3 p-4 rounded-xl bg-card border border-border prose prose-sm dark:prose-invert max-w-none">
                  <MathMarkdown>{result.model_solution}</MathMarkdown>
                </div>
              )}
            </div>
          )}

          {/* Feedback on the AI grading */}
          <FeedbackWidget
            surface="photo_solve"
            prompt="Was this marking helpful?"
            subjectName={subject?.name}
            topicName={topic?.name}
            context={{
              attempt_id: attemptId,
              confidence: result.confidence,
              marks_awarded: result.marks_awarded,
              marks_possible: result.marks_possible,
            }}
          />

          {/* Practice the correction — 5 isomorphic variants */}
          {result.question_detected && result.confidence >= 0.3 && !subjectMismatch && (
            <Button
              onClick={() => setPractising(true)}
              className="w-full gradient-primary gap-2"
            >
              <Target className="h-4 w-4" />
              Practice this correction (5 questions)
            </Button>
          )}

          {/* Try again */}
          <Button onClick={reset} variant="ghost" className="w-full gap-2">
            <RefreshCcw className="h-4 w-4" />
            Try another photo
          </Button>
        </div>
      )}
    </div>
  );
}
