/**
 * PhotoSolvePractice
 *
 * "Practice this correction" — after a photo-solve grading, generates 5
 * isomorphic variants of the photographed question (same method/steps/marks,
 * different values) targeted at the steps the student got wrong, runs them
 * one at a time with AI marking, then shows a before/after improvement
 * summary.
 *
 * XP is awarded for the practice answers (the student's own typed work),
 * results are logged as `photo_solve` learning events and the summary is
 * written back onto the photo_solve_attempts row when an attemptId is given.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Loader2, CheckCircle2, XCircle,
  Sparkles, Target, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MathMarkdown } from './MathMarkdown';
import { aiRequestJSON } from '../lib/aiClient';
import { useUserProgress } from '../hooks/useUserProgress';
import { studySyncHaptic } from '@/lib/haptics';
import { logLearningEvent } from '@/lib/learningEvents';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';
import type { PhotoSolveResult } from './PhotoSolvePanel';

interface VariantQuestion {
  id: string;
  question: string;
  marks: number;
  model_answer: string;
  step_by_step_solution: string;
  marking_scheme: string[];
  target_correction: string;
}

interface MarkResult {
  score?: number;
  totalMarks?: number;
  percentage?: number;
  feedback?: string;
  mistakes?: string[];
  correctParts?: string[];
  modelAnswer?: string;
  improvementTips?: string[];
}

interface QuestionOutcome {
  question: VariantQuestion;
  answer: string;
  percentage: number;
  feedback: string;
  mistakes: string[];
}

interface PhotoSolvePracticeProps {
  original: PhotoSolveResult;
  attemptId?: string | null;
  subjectName?: string;
  topicName?: string;
  curriculum?: string | null;
  onBack: () => void;
}

/** Extract the corrections/steps the student got wrong from the grading. */
export function failedStepsFrom(result: PhotoSolveResult): string[] {
  const failed: string[] = [];
  for (const s of result.steps) {
    if (s.verdict === 'incorrect' || s.verdict === 'partial' || s.verdict === 'missing') {
      failed.push(s.correction || s.reason || s.student_step);
    }
  }
  for (const m of result.missed_steps) failed.push(m);
  return failed.filter((f) => f && f.trim().length > 0).slice(0, 8);
}

export function PhotoSolvePractice({
  original,
  attemptId,
  subjectName,
  topicName,
  curriculum,
  onBack,
}: PhotoSolvePracticeProps) {
  const [phase, setPhase] = useState<'loading' | 'answering' | 'marking' | 'feedback' | 'summary' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<VariantQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [outcomes, setOutcomes] = useState<QuestionOutcome[]>([]);
  const [lastMark, setLastMark] = useState<MarkResult | null>(null);
  const loadedRef = useRef(false);
  const summaryLoggedRef = useRef(false);

  const { addXp, updateStreak } = useUserProgress();

  // ── Load variants once ────────────────────────────────────────────────────
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      try {
        const data = await aiRequestJSON<{ questions: VariantQuestion[] }>('photo-solve-variants', {
          question: original.question_detected,
          model_solution: original.model_solution,
          failed_steps: failedStepsFrom(original),
          subject: subjectName,
          topic: topicName,
          curriculum: curriculum ?? undefined,
          marks: original.marks_possible,
          count: 5,
        });
        const qs = (data?.questions ?? []).filter((q) => q.question && q.model_answer);
        if (qs.length === 0) throw new Error('No practice questions were generated.');
        setQuestions(qs);
        setPhase('answering');
      } catch (e: any) {
        logger.error('photo-solve-variants failed', e);
        setError(String(e?.message || 'Could not generate practice questions.'));
        setPhase('error');
      }
    })();
  }, [original, subjectName, topicName, curriculum]);

  const current = questions[index];

  // ── Mark current answer ───────────────────────────────────────────────────
  const submitAnswer = useCallback(async () => {
    if (!current || !answer.trim()) return;
    setPhase('marking');
    try {
      const result = await aiRequestJSON<MarkResult>('mark-answer', {
        question: current.question,
        studentAnswer: answer.trim(),
        modelAnswer: current.model_answer,
        markingScheme: current.marking_scheme,
        totalMarks: current.marks,
        topic: topicName,
        subject: subjectName,
        mode: 'mark',
        stream: false,
      });
      const pct = Math.max(0, Math.min(100,
        Number(result.percentage ?? ((Number(result.score ?? 0) / Math.max(1, Number(result.totalMarks ?? current.marks))) * 100))));
      const outcome: QuestionOutcome = {
        question: current,
        answer: answer.trim(),
        percentage: Math.round(pct),
        feedback: String(result.feedback ?? ''),
        mistakes: Array.isArray(result.mistakes) ? result.mistakes : [],
      };
      setOutcomes((prev) => [...prev, outcome]);
      setLastMark(result);
      studySyncHaptic(pct >= 70 ? 'quiz.correct' : 'quiz.wrong');
      setPhase('feedback');
    } catch (e: any) {
      logger.error('photo-solve practice marking failed', e);
      setError(String(e?.message || 'Could not mark your answer.'));
      setPhase('error');
    }
  }, [current, answer, subjectName, topicName]);

  const nextQuestion = useCallback(() => {
    setAnswer('');
    setLastMark(null);
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1);
      setPhase('answering');
    } else {
      setPhase('summary');
    }
  }, [index, questions.length]);

  // ── Finish: XP, learning event, write back to attempt ───────────────────
  useEffect(() => {
    if (phase !== 'summary' || summaryLoggedRef.current || outcomes.length === 0) return;
    summaryLoggedRef.current = true;

    const avgPct = Math.round(outcomes.reduce((s, o) => s + o.percentage, 0) / outcomes.length);
    const beforePct = original.marks_possible > 0
      ? Math.round((original.marks_awarded / original.marks_possible) * 100)
      : 0;

    // XP for real practice work (scaled by performance).
    const xp = Math.max(10, Math.round(outcomes.length * 4 + (avgPct / 100) * 20));
    addXp.mutate(xp);
    updateStreak.mutate();
    if (avgPct >= 80) studySyncHaptic('quiz.perfect');

    logLearningEvent({
      source: 'photo_solve' as never,
      topicName: topicName ?? null,
      scorePct: avgPct,
      payload: {
        kind: 'correction_practice',
        attempt_id: attemptId ?? null,
        questions: outcomes.length,
        before_pct: beforePct,
        after_pct: avgPct,
      },
    });

    if (attemptId) {
      (supabase.from('photo_solve_attempts' as never) as any)
        .update({
          practice_questions: outcomes.map((o) => ({
            question: o.question.question,
            target_correction: o.question.target_correction,
            percentage: o.percentage,
          })),
          practice_score_pct: avgPct,
          practiced_at: new Date().toISOString(),
        })
        .eq('id', attemptId)
        .then(({ error: e }: { error: unknown }) => {
          if (e) logger.warn('photo-solve attempt update failed', e);
        });
    }
  }, [phase, outcomes, original, attemptId, topicName, addXp, updateStreak]);

  // ── Render ────────────────────────────────────────────────────────────────
  const header = (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-foreground">Practice the correction</h2>
        <p className="text-xs text-muted-foreground">
          Same question type, new values — master the steps you missed
        </p>
      </div>
    </div>
  );

  if (phase === 'loading') {
    return (
      <div className="space-y-5 animate-fade-in">
        {header}
        <div className="p-6 rounded-xl bg-card border border-border text-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Building your practice set…</p>
          <p className="text-xs text-muted-foreground">
            5 variations of your photographed question, targeting the steps you missed.
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="space-y-5 animate-fade-in">
        {header}
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          {error}
        </div>
        <Button onClick={onBack} variant="outline" className="w-full">Back</Button>
      </div>
    );
  }

  if (phase === 'summary') {
    const avgPct = outcomes.length
      ? Math.round(outcomes.reduce((s, o) => s + o.percentage, 0) / outcomes.length)
      : 0;
    const beforePct = original.marks_possible > 0
      ? Math.round((original.marks_awarded / original.marks_possible) * 100)
      : 0;
    const improved = avgPct > beforePct;
    return (
      <div className="space-y-5 animate-fade-in">
        {header}
        <div className={cn(
          'p-4 rounded-2xl border text-center',
          improved ? 'bg-success/10 border-success/30' : 'bg-muted/40 border-border'
        )}>
          <TrendingUp className={cn('h-6 w-6 mx-auto mb-2', improved ? 'text-success' : 'text-muted-foreground')} />
          <p className="text-sm font-semibold text-foreground mb-1">
            {improved ? 'You improved!' : 'Keep practising'}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm">
            <span className="text-muted-foreground">Photo: <b className="text-foreground">{beforePct}%</b></span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Practice: <b className="text-foreground">{avgPct}%</b></span>
          </div>
        </div>
        <div className="space-y-2">
          {outcomes.map((o, i) => (
            <div key={i} className="p-3 rounded-xl bg-card border border-border flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Q{i + 1}{o.question.target_correction ? ` · ${o.question.target_correction}` : ''}</p>
                <div className="text-sm text-foreground line-clamp-2 prose prose-sm dark:prose-invert max-w-none">
                  <MathMarkdown>{o.question.question}</MathMarkdown>
                </div>
              </div>
              <span className={cn(
                'shrink-0 px-2 py-0.5 rounded-full text-xs font-bold',
                o.percentage >= 70 ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
              )}>{o.percentage}%</span>
            </div>
          ))}
        </div>
        <Button onClick={onBack} className="w-full gradient-primary">Done</Button>
      </div>
    );
  }

  // answering / marking / feedback
  const lastOutcome = outcomes[outcomes.length - 1];
  return (
    <div className="space-y-5 animate-fade-in">
      {header}

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((index + (phase === 'feedback' ? 1 : 0)) / Math.max(1, questions.length)) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {Math.min(index + 1, questions.length)}/{questions.length}
        </span>
      </div>

      {current && (
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          {current.target_correction && (
            <p className="text-[11px] flex items-center gap-1 text-accent-foreground">
              <Target className="h-3 w-3 shrink-0" />
              Practising: {current.target_correction}
            </p>
          )}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MathMarkdown>{current.question}</MathMarkdown>
          </div>
          <p className="text-xs text-muted-foreground">{current.marks} mark{current.marks === 1 ? '' : 's'}</p>
        </div>
      )}

      {phase === 'answering' && (
        <>
          <Textarea
            placeholder="Show your working step by step…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
          />
          <Button
            onClick={submitAnswer}
            disabled={!answer.trim()}
            className="w-full gradient-primary gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Mark my answer
          </Button>
        </>
      )}

      {phase === 'marking' && (
        <div className="p-5 rounded-xl bg-card border border-border text-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Marking…</p>
        </div>
      )}

      {phase === 'feedback' && lastOutcome && (
        <div className="space-y-3">
          <div className={cn(
            'p-4 rounded-2xl border',
            lastOutcome.percentage >= 70 ? 'bg-success/10 border-success/30' : 'bg-warning/10 border-warning/30'
          )}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                {lastOutcome.percentage >= 70
                  ? <CheckCircle2 className="h-4 w-4 text-success" />
                  : <XCircle className="h-4 w-4 text-warning" />}
                {lastOutcome.percentage >= 70 ? 'Well done' : 'Almost — check the feedback'}
              </span>
              <span className="px-3 py-1 rounded-full bg-background/60 text-sm font-bold">
                {lastOutcome.percentage}%
              </span>
            </div>
            {lastOutcome.feedback && (
              <div className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none">
                <MathMarkdown>{lastOutcome.feedback}</MathMarkdown>
              </div>
            )}
          </div>

          {lastOutcome.mistakes.length > 0 && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Watch out for</p>
              <ul className="space-y-1">
                {lastOutcome.mistakes.map((m, i) => (
                  <li key={i} className="text-sm text-foreground">• <MathMarkdown>{m}</MathMarkdown></li>
                ))}
              </ul>
            </div>
          )}

          {lastMark?.modelAnswer && (
            <details className="p-3 rounded-xl bg-card border border-border">
              <summary className="text-sm font-medium cursor-pointer">Model answer</summary>
              <div className="mt-2 prose prose-sm dark:prose-invert max-w-none">
                <MathMarkdown>{lastMark.modelAnswer}</MathMarkdown>
              </div>
            </details>
          )}

          <Button onClick={nextQuestion} className="w-full gradient-primary gap-2">
            {index + 1 < questions.length ? (
              <>Next question <ArrowRight className="h-4 w-4" /></>
            ) : (
              <>See my improvement <TrendingUp className="h-4 w-4" /></>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
