/**
 * ExamModeSession — Timed Exam Simulation
 *
 * Features:
 *   - Timed questions with per-question time allocation
 *   - No hints, no model answers during the exam
 *   - Marks per question visible
 *   - After submission: examiner-grade marking with breakdown and reasoning
 *   - Full mark breakdown showing WHY marks were lost
 *   - Grade boundary classification
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, ArrowRight, Clock, AlertTriangle, Loader2,
  Trophy, Target, XCircle, CheckCircle, BarChart3,
  Lightbulb, RefreshCw, Brain, Flag, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { MathMarkdown } from './MathMarkdown';
import { QuestionVisual } from './QuestionVisual';
import { useRecallEngine } from '../hooks/useRecallEngine';
import type { Subject, Topic } from '../types/study';
import type { SemanticEvaluation } from '../engine/recallEngine';

interface ExamModeSessionProps {
  subject: Subject;
  topic?: Topic;
  onComplete: () => void;
  onBack: () => void;
}

// Grade boundaries
function getGrade(percentage: number): { grade: string; label: string; color: string } {
  if (percentage >= 90) return { grade: 'A*', label: 'Outstanding', color: 'text-success' };
  if (percentage >= 80) return { grade: 'A', label: 'Excellent', color: 'text-success' };
  if (percentage >= 70) return { grade: 'B', label: 'Good', color: 'text-accent' };
  if (percentage >= 60) return { grade: 'C', label: 'Satisfactory', color: 'text-warning' };
  if (percentage >= 50) return { grade: 'D', label: 'Below Average', color: 'text-warning' };
  if (percentage >= 40) return { grade: 'E', label: 'Weak', color: 'text-destructive' };
  return { grade: 'U', label: 'Ungraded', color: 'text-destructive' };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ExamModeSession({ subject, topic, onComplete, onBack }: ExamModeSessionProps) {
  const engine = useRecallEngine({ subject, topic, mode: 'exam', questionCount: 10 });

  const [answers, setAnswers] = useState<Map<number, string>>(new Map());
  const [evaluations, setEvaluations] = useState<Map<number, SemanticEvaluation>>(new Map());
  const [questionStartTimes, setQuestionStartTimes] = useState<Map<number, number>>(new Map());
  const [phase, setPhase] = useState<'instructions' | 'exam' | 'marking' | 'results'>('instructions');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [showOverview, setShowOverview] = useState(false);
  const [markingProgress, setMarkingProgress] = useState(0);

  // Track per-question time
  useEffect(() => {
    if (phase === 'exam') {
      setQuestionStartTimes(prev => {
        const next = new Map(prev);
        if (!next.has(engine.currentIndex)) {
          next.set(engine.currentIndex, Date.now());
        }
        return next;
      });
    }
  }, [engine.currentIndex, phase]);

  // Generate questions when context is loaded
  useEffect(() => {
    if (engine.contextLoaded && engine.questions.length === 0 && !engine.isGenerating) {
      engine.generateQuestions(10);
    }
  }, [engine.contextLoaded]);

  // Start exam timer when entering exam phase
  useEffect(() => {
    if (phase === 'exam' && engine.questions.length > 0) {
      engine.startExamTimer();
    }
    return () => { engine.stopExamTimer(); };
  }, [phase, engine.questions.length]);

  const handleAnswerChange = useCallback((value: string) => {
    setAnswers(prev => {
      const next = new Map(prev);
      next.set(engine.currentIndex, value);
      return next;
    });
  }, [engine.currentIndex]);

  const toggleFlag = useCallback(() => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(engine.currentIndex)) {
        next.delete(engine.currentIndex);
      } else {
        next.add(engine.currentIndex);
      }
      return next;
    });
  }, [engine.currentIndex]);

  // Submit all answers for AI marking
  const handleSubmitExam = useCallback(async () => {
    engine.stopExamTimer();
    setPhase('marking');
    setIsSubmitting(true);

    const total = engine.questions.length;

    for (let i = 0; i < total; i++) {
      const answer = answers.get(i) || '';
      const startTime = questionStartTimes.get(i) || Date.now();
      const timeTaken = Math.round((Date.now() - startTime) / 1000);

      if (answer.trim()) {
        const result = await engine.evaluateAnswer(i, answer, timeTaken);
        if (result) {
          setEvaluations(prev => {
            const next = new Map(prev);
            next.set(i, result);
            return next;
          });
        }
      }

      setMarkingProgress(Math.round(((i + 1) / total) * 100));
    }

    setIsSubmitting(false);
    setPhase('results');
    engine.completeSession();
  }, [answers, questionStartTimes, engine]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (engine.isGenerating && engine.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
        <Brain className="h-12 w-12 text-destructive animate-pulse" />
        <h3 className="text-lg font-bold text-foreground">Preparing Exam Paper</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Generating exam-style questions matched to your syllabus...
        </p>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (engine.error && engine.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-destructive">{engine.error}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={() => engine.generateQuestions(10)} className="gradient-primary">
            <RefreshCw className="mr-2 h-4 w-4" /> Try Again
          </Button>
        </div>
      </div>
    );
  }

  // ── Instructions Phase ───────────────────────────────────────────────────

  if (phase === 'instructions' && engine.questions.length > 0) {
    const totalMarks = engine.questions.reduce((s, q) => s + q.marks, 0);
    const totalTime = engine.questions.reduce((s, q) => s + q.timeAllocationSecs, 0);

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center space-y-3">
          <Clock className="h-14 w-14 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Exam Mode</h2>
          <p className="text-sm text-muted-foreground">
            {subject.name} - {(topic || subject.currentTopic).name}
          </p>
        </div>

        <Card className="border-destructive/20">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-bold text-foreground">Exam Conditions</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-destructive">{engine.questions.length}</p>
                <p className="text-xs text-muted-foreground">Questions</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalMarks}</p>
                <p className="text-xs text-muted-foreground">Total Marks</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-warning">{formatTime(totalTime)}</p>
                <p className="text-xs text-muted-foreground">Time Limit</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>- No hints or model answers during the exam</p>
              <p>- Questions are timed - manage your time carefully</p>
              <p>- Each question will be marked by AI examiner</p>
              <p>- Grade boundaries: A* (90%+), A (80%+), B (70%+), C (60%+)</p>
              <p>- You can flag questions to review before submitting</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">Cancel</Button>
          <Button onClick={() => setPhase('exam')} className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            <Clock className="mr-2 h-4 w-4" />
            Start Exam
          </Button>
        </div>
      </div>
    );
  }

  // ── Marking Phase ────────────────────────────────────────────────────────

  if (phase === 'marking') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
        <Brain className="h-12 w-12 text-accent animate-pulse" />
        <h3 className="text-lg font-bold text-foreground">AI Examiner Marking</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Evaluating each answer against the marking scheme...
        </p>
        <Progress value={markingProgress} className="w-64 h-3" />
        <p className="text-xs text-muted-foreground">{markingProgress}% complete</p>
      </div>
    );
  }

  // ── Results Phase ────────────────────────────────────────────────────────

  if (phase === 'results') {
    const stats = engine.sessionStats;
    const totalMarks = engine.questions.reduce((s, q) => s + q.marks, 0);
    const marksAwarded = Array.from(evaluations.values()).reduce((s, e) => s + e.marksAwarded, 0);
    const percentage = totalMarks > 0 ? Math.round((marksAwarded / totalMarks) * 100) : 0;
    const grade = getGrade(percentage);

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Grade Card */}
        <Card className="border-2 border-accent/20">
          <CardContent className="p-6 text-center space-y-3">
            <Trophy className="h-14 w-14 mx-auto text-warning" />
            <div>
              <p className={cn("text-6xl font-black", grade.color)}>{grade.grade}</p>
              <p className="text-sm text-muted-foreground">{grade.label}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
              <div>
                <p className="text-2xl font-bold text-foreground">{marksAwarded}/{totalMarks}</p>
                <p className="text-xs text-muted-foreground">Marks</p>
              </div>
              <div>
                <p className={cn("text-2xl font-bold", grade.color)}>{percentage}%</p>
                <p className="text-xs text-muted-foreground">Percentage</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats ? Math.floor(stats.sessionDurationSecs / 60) : 0}m
                </p>
                <p className="text-xs text-muted-foreground">Time Used</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-Question Breakdown */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              Question-by-Question Results
            </h3>
            {engine.questions.map((q, i) => {
              const eval_ = evaluations.get(i);
              const answered = (answers.get(i) || '').trim().length > 0;

              return (
                <QuestionResult
                  key={q.id}
                  questionNumber={i + 1}
                  question={q.question}
                  marks={q.marks}
                  evaluation={eval_ || null}
                  userAnswer={answers.get(i) || ''}
                  modelAnswer={q.modelAnswer}
                  answered={answered}
                  visual={q.visual ?? null}
                  commandWord={q.commandWord}
                />
              );
            })}
          </CardContent>
        </Card>

        {/* Insights */}
        {engine.insights.length > 0 && (
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-warning" />
                Examiner Notes
              </h3>
              {engine.insights.slice(0, 5).map(insight => (
                <div
                  key={insight.id}
                  className={cn(
                    "p-3 rounded-xl border text-sm",
                    insight.severity === 'critical' ? 'bg-destructive/5 border-destructive/20' :
                    insight.severity === 'warning' ? 'bg-warning/5 border-warning/20' :
                    'bg-accent/5 border-accent/20'
                  )}
                >
                  <p className="font-medium text-foreground">{insight.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back to Tasks
          </Button>
          <Button onClick={onComplete} className="flex-1 gradient-primary">
            <CheckCircle className="mr-2 h-4 w-4" />
            Complete
          </Button>
        </div>
      </div>
    );
  }

  // ── Exam Phase ───────────────────────────────────────────────────────────

  const q = engine.currentQuestion;
  if (!q) return null;

  const currentAnswer = answers.get(engine.currentIndex) || '';
  const isFlagged = flaggedQuestions.has(engine.currentIndex);
  const answeredCount = Array.from(answers.values()).filter(a => a.trim().length > 0).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Timer Bar */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/10 border border-destructive/20">
        <div className="flex items-center gap-2">
          <Clock className={cn(
            "h-5 w-5",
            (engine.examTimeRemaining || 0) < 300 ? "text-destructive animate-pulse" : "text-destructive"
          )} />
          <span className={cn(
            "font-mono text-lg font-bold",
            (engine.examTimeRemaining || 0) < 300 ? "text-destructive" : "text-foreground"
          )}>
            {formatTime(engine.examTimeRemaining || 0)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {answeredCount}/{engine.questions.length} answered
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOverview(!showOverview)}
            className="text-xs"
          >
            {showOverview ? 'Hide' : 'Overview'}
          </Button>
        </div>
      </div>

      {/* Question Overview Grid */}
      {showOverview && (
        <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-muted/50 border border-border">
          {engine.questions.map((_, i) => {
            const hasAnswer = (answers.get(i) || '').trim().length > 0;
            const isActive = i === engine.currentIndex;
            const isFl = flaggedQuestions.has(i);

            return (
              <button
                key={i}
                onClick={() => {
                  // Navigate to this question
                  const diff = i - engine.currentIndex;
                  if (diff > 0) for (let j = 0; j < diff; j++) engine.goToNextQuestion();
                  else if (diff < 0) for (let j = 0; j < Math.abs(diff); j++) engine.goToPreviousQuestion();
                }}
                className={cn(
                  "w-9 h-9 rounded-lg text-xs font-bold flex items-center justify-center border transition-colors",
                  isActive ? "border-accent bg-accent text-accent-foreground" :
                  hasAnswer ? "border-success/30 bg-success/10 text-success" :
                  isFl ? "border-warning/30 bg-warning/10 text-warning" :
                  "border-border bg-muted/30 text-muted-foreground"
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Question — exam-paper styling */}
      <Card className="border-destructive/20 bg-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground tracking-wide">
                Question {engine.progress.current}
              </span>
              {q.commandWord && (
                <Badge variant="outline" className="text-xs uppercase tracking-wider">
                  {q.commandWord}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFlag}
                className={cn("h-7 px-2", isFlagged && "text-warning")}
              >
                <Flag className={cn("h-3.5 w-3.5", isFlagged && "fill-warning")} />
              </Button>
              <Badge className="bg-destructive/15 text-destructive border-destructive/30 font-mono">
                [{q.marks} {q.marks === 1 ? "mark" : "marks"}]
              </Badge>
            </div>
          </div>

          {/* Question stem rendered as exam-paper parts (a)/(b)/(c) */}
          <ExamQuestionStem text={q.question} />

          {/* Diagram / graph / figure */}
          {q.visual && (
            <div className="mt-4">
              <QuestionVisual visual={q.visual} />
            </div>
          )}

          {/* Time per question hint */}
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1 italic">
            <Clock className="h-3 w-3" />
            Suggested time: {Math.ceil(q.timeAllocationSecs / 60)} min
          </p>
        </CardContent>
      </Card>

      {/* Answer Area - No hints in exam mode */}
      <div className="space-y-3">
        {q.questionType === 'multiple_choice' && q.options ? (
          <div className="space-y-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswerChange(opt)}
                className={cn(
                  "w-full text-left p-3 rounded-xl border text-sm transition-colors",
                  currentAnswer === opt
                    ? "border-accent bg-accent/10"
                    : "border-border bg-muted/30 hover:bg-muted/50"
                )}
              >
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <Textarea
            placeholder="Write your answer here. Show all working..."
            value={currentAnswer}
            onChange={e => handleAnswerChange(e.target.value)}
            className="min-h-[180px] text-sm"
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => engine.goToPreviousQuestion()}
          disabled={engine.currentIndex === 0}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        {engine.currentIndex < engine.questions.length - 1 ? (
          <Button
            onClick={() => engine.goToNextQuestion()}
            className="flex-1 gradient-primary"
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmitExam}
            disabled={isSubmitting}
            className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            Submit Exam
          </Button>
        )}
      </div>

      {/* Progress */}
      <Progress value={(answeredCount / engine.questions.length) * 100} className="h-1.5" />
    </div>
  );
}

// ── Sub-component: Exam-paper question stem ────────────────────────────────
//
// Renders the question text in proper exam-paper formatting:
//   - Splits multi-part questions on "(a)", "(b)", "(c)..." markers and
//     renders each part as its own block, indented with a labelled gutter.
//   - Uses serif-leaning typography to feel like a real paper.
//   - Falls back to a single block when no parts are detected.

function ExamQuestionStem({ text }: { text: string }) {
  const parts = splitIntoParts(text);

  if (parts.length <= 1) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed [&_p]:my-2">
        <MathMarkdown>{text}</MathMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {parts.map((p, i) => (
        <div key={i} className="flex gap-3">
          <span className="font-mono text-sm font-semibold text-muted-foreground w-7 shrink-0 pt-0.5">
            ({p.label})
          </span>
          <div className="flex-1 prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed [&_p]:my-1">
            <MathMarkdown>{p.body}</MathMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}

function splitIntoParts(text: string): { label: string; body: string }[] {
  // Match (a) (b) (i) (ii) etc at the start of a line or after whitespace.
  const regex = /(?:^|\n|\s)\(([a-z]{1,3}|[ivx]{1,4})\)\s+/gi;
  const matches: { idx: number; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    // Prefer matches that come at the start of a line for cleaner splits
    matches.push({ idx: m.index + m[0].indexOf("("), label: m[1] });
  }
  if (matches.length < 2) return [{ label: "", body: text }];

  const out: { label: string; body: string }[] = [];
  // Preamble before first part (if any) becomes its own un-labelled block
  if (matches[0].idx > 0) {
    const pre = text.slice(0, matches[0].idx).trim();
    if (pre) out.push({ label: "stem", body: pre });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx;
    const end = i < matches.length - 1 ? matches[i + 1].idx : text.length;
    const segment = text.slice(start, end);
    const body = segment.replace(/^\([a-z]{1,3}|[ivx]{1,4}\)\s+/i, "").trim();
    out.push({ label: matches[i].label, body });
  }
  // If our preamble fallback created a single "stem" but no real parts followed
  // (defensive), just return the original.
  if (out.length === 1) return [{ label: "", body: text }];
  return out;
}

// ── Sub-component: Per-question result ─────────────────────────────────────

import type { QuestionVisualSpec } from './QuestionVisual';

function QuestionResult({
  questionNumber,
  question,
  marks,
  evaluation,
  userAnswer,
  modelAnswer,
  answered,
  visual,
  commandWord,
}: {
  questionNumber: number;
  question: string;
  marks: number;
  evaluation: SemanticEvaluation | null;
  userAnswer: string;
  modelAnswer: string;
  answered: boolean;
  visual?: QuestionVisualSpec | null;
  commandWord?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      "p-3 rounded-xl border",
      !answered ? "bg-muted/30 border-border" :
      evaluation && evaluation.percentage >= 70 ? "bg-success/5 border-success/20" :
      evaluation && evaluation.percentage >= 50 ? "bg-warning/5 border-warning/20" :
      "bg-destructive/5 border-destructive/20"
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-foreground">Q{questionNumber}</span>
          {commandWord && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              {commandWord}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] font-mono">
            [{marks} {marks === 1 ? "mark" : "marks"}]
          </Badge>
          {!answered ? (
            <Badge variant="outline" className="text-xs text-muted-foreground">Unanswered</Badge>
          ) : evaluation ? (
            <span className={cn(
              "text-sm font-bold",
              evaluation.percentage >= 70 ? "text-success" :
              evaluation.percentage >= 50 ? "text-warning" : "text-destructive"
            )}>
              {evaluation.marksAwarded}/{evaluation.totalMarks}
            </span>
          ) : (
            <Badge variant="outline" className="text-xs">Pending</Badge>
          )}
        </div>
        {expanded ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 text-sm">
          <ExamQuestionStem text={question} />

          {visual && <QuestionVisual visual={visual} />}

          {/* Examiner's overall comment */}
          {evaluation?.examinerComment && (
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/30">
              <p className="text-[11px] font-bold uppercase tracking-wider text-accent mb-1">
                Examiner's Comment
              </p>
              <p className="text-foreground text-xs leading-relaxed italic">
                "{evaluation.examinerComment}"
              </p>
            </div>
          )}

          {/* Workings / presentation warning — even when answer is correct */}
          {evaluation?.workingsFeedback && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
              <p className="text-[11px] font-bold uppercase tracking-wider text-warning mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Workings & Presentation
              </p>
              <p className="text-foreground text-xs leading-relaxed">
                {evaluation.workingsFeedback}
              </p>
            </div>
          )}

          {userAnswer && (
            <div className="p-2 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Your Answer:</p>
              <p className="text-foreground whitespace-pre-wrap text-xs">{userAnswer}</p>
            </div>
          )}

          {/* Per-marking-point breakdown with examiner's reasoning */}
          {evaluation?.markBreakdown && evaluation.markBreakdown.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Mark-by-mark breakdown
              </p>
              {evaluation.markBreakdown.map((item, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-background/60 border border-border space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className={cn(
                      "font-mono text-xs px-1.5 py-0.5 rounded shrink-0",
                      item.marksAwarded === item.marksAvailable ? "bg-success/15 text-success" :
                      item.marksAwarded > 0 ? "bg-warning/15 text-warning" :
                      "bg-destructive/15 text-destructive"
                    )}>
                      {item.marksAwarded}/{item.marksAvailable}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{item.criterion}</p>
                      {item.comment && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{item.comment}</p>
                      )}
                    </div>
                  </div>
                  {item.whyExpected && (
                    <p className="text-[11px] text-muted-foreground italic pl-1 border-l-2 border-accent/30 ml-1 pl-2">
                      <span className="font-semibold not-italic text-accent">Why expected: </span>
                      {item.whyExpected}
                    </p>
                  )}
                  {item.studentQuote && (
                    <p className="text-[11px] text-muted-foreground pl-1">
                      <span className="font-semibold">You wrote: </span>
                      <span className="italic">"{item.studentQuote}"</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Common mistakes */}
          {evaluation?.feedback.reasoningErrors && evaluation.feedback.reasoningErrors.length > 0 && (
            <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
              <p className="text-[11px] font-bold uppercase tracking-wider text-destructive mb-1">
                Examiner would flag
              </p>
              <ul className="text-xs text-foreground space-y-1">
                {evaluation.feedback.reasoningErrors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Curriculum-specific improvement tips */}
          {evaluation?.improvementByCurriculum && evaluation.improvementByCurriculum.length > 0 && (
            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1">
                How to improve next time (curriculum standards)
              </p>
              <ul className="text-xs text-foreground space-y-1">
                {evaluation.improvementByCurriculum.map((tip, i) => (
                  <li key={i}>• {tip}</li>
                ))}
              </ul>
            </div>
          )}

          {modelAnswer && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-accent">View model answer</summary>
              <div className="mt-1 text-muted-foreground prose prose-sm dark:prose-invert max-w-none">
                <MathMarkdown>{modelAnswer}</MathMarkdown>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
