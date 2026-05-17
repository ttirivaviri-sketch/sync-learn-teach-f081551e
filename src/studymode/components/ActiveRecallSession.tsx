/**
 * ActiveRecallSession — Core Active Recall Engine UI
 *
 * Presents 10+ questions one at a time. For each question:
 *   1. Shows the question with marks and topic info
 *   2. Student writes their answer
 *   3. AI evaluates semantically (key concepts, score 0-100%, misconceptions)
 *   4. Shows structured feedback: correct/missing/misconceptions, model answer, mark explanation
 *   5. Feeds result into mastery scoring, spaced repetition, personalization
 *
 * After all questions: shows session summary with mastery updates and insights.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, ArrowRight, Brain, CheckCircle, AlertTriangle,
  Loader2, Target, Trophy, Lightbulb, XCircle, BarChart3,
  Clock, Zap, BookOpen, ChevronDown, ChevronUp, RefreshCw,
  SkipForward, MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { MathMarkdown } from './MathMarkdown';
import { useRecallEngine } from '../hooks/useRecallEngine';
import type { Subject, Topic } from '../types/study';
import type { SemanticEvaluation, MasteryClassification } from '../engine/recallEngine';
import { useStudyMemory } from '../hooks/useStudyMemory';

interface ActiveRecallSessionProps {
  subject: Subject;
  topic?: Topic;
  onComplete: () => void;
  onBack: () => void;
}

export function ActiveRecallSession({ subject, topic, onComplete, onBack }: ActiveRecallSessionProps) {
  const { logEvent } = useStudyMemory();
  const engine = useRecallEngine({ subject, topic, mode: 'active-recall', questionCount: 10 });

  const [userAnswer, setUserAnswer] = useState('');
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [evaluation, setEvaluation] = useState<SemanticEvaluation | null>(null);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [phase, setPhase] = useState<'answering' | 'evaluating' | 'feedback'>('answering');

  // Auto-generate questions on mount
  useEffect(() => {
    if (engine.contextLoaded && engine.questions.length === 0 && !engine.isGenerating) {
      engine.generateQuestions(10);
    }
  }, [engine.contextLoaded]);

  // Reset state when moving to next question
  useEffect(() => {
    setUserAnswer('');
    setEvaluation(null);
    setShowModelAnswer(false);
    setPhase('answering');
    setQuestionStartTime(Date.now());
  }, [engine.currentIndex]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!userAnswer.trim() || !engine.currentQuestion) return;

    setPhase('evaluating');
    const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);
    const q = engine.currentQuestion as any;
    const result = await engine.evaluateAnswer(engine.currentIndex, userAnswer, timeTaken);

    if (result) {
      setEvaluation(result);
      setPhase('feedback');

      // ── Log to AI memory (fire-and-forget) ─────────────────────
      logEvent({
        eventType: 'quiz_question',
        subjectId: subject.id,
        subjectName: subject.name,
        topicName: topic?.name ?? subject.currentTopic?.name ?? 'Unknown',
        curriculum: subject.curriculum,
        questionText: q?.question ?? q?.front,
        conceptsTested: q?.conceptsTested ?? [],
        commandWord: q?.commandWord,
        wasCorrect: result.percentage >= 60,
        scoreRaw: result.marksAwarded,
        scoreMax: result.totalMarks,
        difficulty: q?.difficulty,
        metadata: { timeTakenSecs: timeTaken, masteryClass: result.classification },
      });
    } else {
      // Fallback if evaluation failed
      setPhase('feedback');
    }
  }, [userAnswer, engine.currentQuestion, engine.currentIndex, engine.evaluateAnswer, questionStartTime, subject, topic, logEvent]);

  const handleNextQuestion = useCallback(() => {
    engine.goToNextQuestion();
  }, [engine.goToNextQuestion]);

  const handleSkip = useCallback(() => {
    engine.skipQuestion();
  }, [engine.skipQuestion]);

  const getMasteryBadge = (classification: MasteryClassification) => {
    switch (classification) {
      case 'mastered':
        return <Badge className="bg-success/15 text-success border-success/30">Mastered</Badge>;
      case 'developing':
        return <Badge className="bg-warning/15 text-warning border-warning/30">Developing</Badge>;
      case 'needs_reinforcement':
        return <Badge className="bg-destructive/15 text-destructive border-destructive/30">Needs Reinforcement</Badge>;
    }
  };

  // ── Loading State ────────────────────────────────────────────────────────

  if (engine.isGenerating && engine.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
        <Brain className="h-12 w-12 text-accent animate-pulse" />
        <h3 className="text-lg font-bold text-foreground">Generating Your Questions</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Creating {10} personalised questions based on your syllabus and performance...
        </p>
        <div className="flex gap-2">
          {engine.difficulty === 'foundation' && <Badge variant="outline" className="text-success">Foundation Level</Badge>}
          {engine.difficulty === 'standard' && <Badge variant="outline" className="text-accent">Standard Level</Badge>}
          {engine.difficulty === 'advanced' && <Badge variant="outline" className="text-destructive">Advanced Level</Badge>}
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────────────

  if (engine.error && engine.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <h3 className="text-lg font-bold text-foreground">Generation Failed</h3>
        <p className="text-sm text-destructive text-center max-w-xs">{engine.error}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={() => engine.generateQuestions(10)} className="gradient-primary">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // ── Session Complete ─────────────────────────────────────────────────────

  if (engine.isComplete) {
    const stats = engine.sessionStats;
    const masteries = Array.from(engine.masteries.values());

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-3">
          <Trophy className="h-14 w-14 text-warning mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Session Complete!</h2>
          <p className="text-sm text-muted-foreground">
            {subject.name} - {(topic || subject.currentTopic).name}
          </p>
        </div>

        {/* Score Summary */}
        {stats && (
          <Card className="border-accent/20">
            <CardContent className="p-5">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-accent">{stats.questionsAnswered}</p>
                  <p className="text-xs text-muted-foreground">Questions</p>
                </div>
                <div>
                  <p className={cn("text-2xl font-bold", stats.averageScore >= 70 ? "text-success" : stats.averageScore >= 50 ? "text-warning" : "text-destructive")}>
                    {stats.averageScore}%
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {stats.marksAwarded}/{stats.totalMarks}
                  </p>
                  <p className="text-xs text-muted-foreground">Marks</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {Math.floor(stats.sessionDurationSecs / 60)}m
                  </p>
                  <p className="text-xs text-muted-foreground">Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mastery Updates */}
        {masteries.length > 0 && (
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Target className="h-5 w-5 text-accent" />
                Mastery Updates
              </h3>
              {masteries.map(m => (
                <div key={`${m.subject}::${m.topic}`} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.topic}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(m.accuracy * 100)}% accuracy | {m.totalAttempts} attempts
                    </p>
                  </div>
                  <div className="text-right">
                    {getMasteryBadge(m.classification)}
                    {m.nextReviewDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Next review: {m.nextReviewDate}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Strong & Weak Concepts */}
        {stats && (stats.strongConcepts.length > 0 || stats.weakConcepts.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {stats.strongConcepts.length > 0 && (
              <Card className="border-success/20">
                <CardContent className="p-4">
                  <h4 className="text-sm font-bold text-success mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Strong Areas
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {stats.strongConcepts.map(c => (
                      <Badge key={c} variant="outline" className="text-xs border-success/30 text-success capitalize">{c}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {stats.weakConcepts.length > 0 && (
              <Card className="border-destructive/20">
                <CardContent className="p-4">
                  <h4 className="text-sm font-bold text-destructive mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4" /> Weak Areas
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {stats.weakConcepts.map(c => (
                      <Badge key={c} variant="outline" className="text-xs border-destructive/30 text-destructive capitalize">{c}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Insights */}
        {engine.insights.length > 0 && (
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-warning" />
                AI Insights
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

  // ── No Question Available ────────────────────────────────────────────────

  if (!engine.currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
        <BookOpen className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No questions available</p>
        <Button variant="outline" onClick={onBack}>Back</Button>
      </div>
    );
  }

  const q = engine.currentQuestion;

  // ── Question UI ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Progress & Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground truncate flex items-center gap-2">
                <Brain className="h-5 w-5 text-accent shrink-0" />
                Active Recall
              </h3>
              <span className="text-sm font-medium text-muted-foreground shrink-0">
                {engine.progress.current}/{engine.progress.total}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {subject.name} - {(topic || subject.currentTopic).name}
            </p>
          </div>
        </div>
        <Progress value={(engine.currentIndex / engine.questions.length) * 100} className="h-2" />

        {/* Mastery & Difficulty Badges */}
        <div className="flex flex-wrap gap-2">
          {engine.currentMastery && getMasteryBadge(engine.currentMastery.classification)}
          <Badge variant="outline" className={cn(
            "text-xs",
            engine.difficulty === 'foundation' ? "border-success/30 text-success" :
            engine.difficulty === 'advanced' ? "border-destructive/30 text-destructive" :
            "border-accent/30 text-accent"
          )}>
            {engine.difficulty === 'foundation' ? 'Foundation' : engine.difficulty === 'advanced' ? 'Advanced' : 'Standard'}
          </Badge>
          {q.source === 'spaced-review' && (
            <Badge variant="outline" className="text-xs border-warning/30 text-warning">
              <RefreshCw className="h-3 w-3 mr-1" />
              Spaced Review
            </Badge>
          )}
          {q.commandWord && (
            <Badge variant="outline" className="text-xs">
              {q.commandWord}
            </Badge>
          )}
        </div>
      </div>

      {/* Question Card */}
      <Card className="border-accent/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Question {engine.progress.current}
            </span>
            <Badge variant="outline" className="text-accent">
              {q.marks} marks
            </Badge>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
            <MathMarkdown>{q.question}</MathMarkdown>
          </div>
          {q.conceptsTested.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {q.conceptsTested.slice(0, 4).map(c => (
                <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{c}</span>
              ))}
            </div>
          )}

          {/* Multiple choice options */}
          {q.questionType === 'multiple_choice' && q.options && phase === 'answering' && (
            <div className="mt-4 space-y-2">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setUserAnswer(opt)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border text-sm transition-colors",
                    userAnswer === opt
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border bg-muted/30 hover:bg-muted/50 text-foreground"
                  )}
                >
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  <MathMarkdown className="inline [&_p]:inline [&_p]:my-0">
                    {opt}
                  </MathMarkdown>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Answer Phase */}
      {phase === 'answering' && q.questionType !== 'multiple_choice' && (
        <div className="space-y-3">
          <Textarea
            placeholder="Write your complete answer here. Show all working and reasoning steps..."
            value={userAnswer}
            onChange={e => setUserAnswer(e.target.value)}
            className="min-h-[180px] text-sm"
          />
          <div className="flex gap-3">
            <Button
              onClick={handleSubmitAnswer}
              disabled={!userAnswer.trim() || engine.isEvaluating}
              className="flex-1 gradient-primary"
            >
              {engine.isEvaluating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Evaluating...</>
              ) : (
                <>Submit Answer <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
            <Button variant="ghost" onClick={handleSkip} className="shrink-0 text-muted-foreground">
              <SkipForward className="h-4 w-4 mr-1" />
              Skip
            </Button>
          </div>
        </div>
      )}

      {/* MC submit */}
      {phase === 'answering' && q.questionType === 'multiple_choice' && (
        <Button
          onClick={handleSubmitAnswer}
          disabled={!userAnswer.trim() || engine.isEvaluating}
          className="w-full gradient-primary"
        >
          {engine.isEvaluating ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Evaluating...</>
          ) : (
            <>Submit Answer <ArrowRight className="ml-2 h-4 w-4" /></>
          )}
        </Button>
      )}

      {/* Evaluating Phase */}
      {phase === 'evaluating' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm font-medium text-foreground">AI is evaluating your answer...</p>
          <p className="text-xs text-muted-foreground">Analysing key concepts, reasoning, and accuracy</p>
        </div>
      )}

      {/* Feedback Phase */}
      {phase === 'feedback' && (
        <div className="space-y-4">
          {/* Score */}
          {evaluation && (
            <Card className={cn(
              "border-2",
              evaluation.percentage >= 70 ? "border-success/30" :
              evaluation.percentage >= 50 ? "border-warning/30" :
              "border-destructive/30"
            )}>
              <CardContent className="p-5 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {evaluation.percentage >= 70 ? 'Excellent!' : evaluation.percentage >= 50 ? 'Good effort!' : 'Keep practicing!'}
                </p>
                <p className={cn(
                  "text-4xl font-bold",
                  evaluation.percentage >= 70 ? "text-success" :
                  evaluation.percentage >= 50 ? "text-warning" :
                  "text-destructive"
                )}>
                  {evaluation.marksAwarded}/{evaluation.totalMarks}
                </p>
                <p className="text-sm text-muted-foreground">{evaluation.percentage}%</p>
              </CardContent>
            </Card>
          )}

          {/* Mark Breakdown */}
          {evaluation?.markBreakdown && evaluation.markBreakdown.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Mark Breakdown</h4>
                {evaluation.markBreakdown.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className={cn(
                      "font-mono text-xs px-1.5 py-0.5 rounded shrink-0",
                      item.marksAwarded === item.marksAvailable ? "bg-success/15 text-success" :
                      item.marksAwarded > 0 ? "bg-warning/15 text-warning" :
                      "bg-destructive/15 text-destructive"
                    )}>
                      {item.marksAwarded}/{item.marksAvailable}
                    </span>
                    <div>
                      <span className="font-medium text-foreground">{item.criterion}</span>
                      {item.comment && <p className="text-xs text-muted-foreground mt-0.5">{item.comment}</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Correct Concepts */}
          {evaluation?.correctConcepts && evaluation.correctConcepts.length > 0 && (
            <div className="p-4 rounded-xl bg-success/5 border border-success/20">
              <h4 className="text-sm font-bold text-success mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> What You Got Right
              </h4>
              <ul className="text-sm text-foreground space-y-1">
                {evaluation.correctConcepts.map((c, i) => <li key={i}>+ {c}</li>)}
              </ul>
            </div>
          )}

          {/* Missing Concepts */}
          {evaluation?.missingConcepts && evaluation.missingConcepts.length > 0 && (
            <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
              <h4 className="text-sm font-bold text-warning mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> What Was Missing
              </h4>
              <ul className="text-sm text-foreground space-y-1">
                {evaluation.missingConcepts.map((c, i) => <li key={i}>- {c}</li>)}
              </ul>
            </div>
          )}

          {/* Misconceptions */}
          {evaluation?.misconceptions && evaluation.misconceptions.length > 0 && (
            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
              <h4 className="text-sm font-bold text-destructive mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4" /> Misconceptions Detected
              </h4>
              <ul className="text-sm text-foreground space-y-1">
                {evaluation.misconceptions.map((m, i) => <li key={i}>! {m}</li>)}
              </ul>
            </div>
          )}

          {/* Reasoning Errors */}
          {evaluation?.feedback.reasoningErrors && evaluation.feedback.reasoningErrors.length > 0 && (
            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
              <h4 className="text-sm font-bold text-destructive mb-2 flex items-center gap-2">
                <MessageCircle className="h-4 w-4" /> Why These Parts Are Wrong
              </h4>
              <ul className="text-sm text-foreground space-y-1">
                {evaluation.feedback.reasoningErrors.map((err, i) => <li key={i}>- {err}</li>)}
              </ul>
            </div>
          )}

          {/* Lost Marks Explanation */}
          {evaluation?.feedback.lostMarksExplanation && (
            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
              <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-accent" /> Mark Explanation
              </h4>
              <p className="text-sm text-muted-foreground">{evaluation.feedback.lostMarksExplanation}</p>
            </div>
          )}

          {/* Improvement Tips */}
          {evaluation?.improvementTips && evaluation.improvementTips.length > 0 && (
            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
              <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent" /> Tips for Next Time
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {evaluation.improvementTips.map((tip, i) => <li key={i}>- {tip}</li>)}
              </ul>
            </div>
          )}

          {/* Model Answer Toggle */}
          <Button
            variant="outline"
            onClick={() => setShowModelAnswer(!showModelAnswer)}
            className="w-full"
          >
            {showModelAnswer ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
            {showModelAnswer ? 'Hide' : 'Show'} Model Answer
          </Button>

          {showModelAnswer && q.modelAnswer && (
            <div className="p-4 rounded-xl bg-success/5 border border-success/20">
              <h4 className="text-sm font-bold text-success mb-2">Model Answer</h4>
              <div className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none">
                <MathMarkdown>{q.modelAnswer}</MathMarkdown>
              </div>
            </div>
          )}

          {/* Next / Complete */}
          <div className="flex gap-3">
            {engine.currentIndex < engine.questions.length - 1 ? (
              <Button onClick={handleNextQuestion} className="flex-1 gradient-primary">
                Next Question
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => engine.completeSession()} className="flex-1 gradient-success">
                <Trophy className="mr-2 h-4 w-4" />
                Finish Session
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
