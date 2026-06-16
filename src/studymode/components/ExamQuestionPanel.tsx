import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle, ArrowRight, Eye, Lightbulb,
  ThumbsUp, ThumbsDown, MessageCircle, Loader2 as LoaderIcon,
  BookOpen, Zap, Trophy, Target, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PhotoAnswerButton } from './PhotoAnswerButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { MathMarkdown } from './MathMarkdown';
import { QuestionVisual } from './QuestionVisual';
import { useQuizGenerator } from '../hooks/useQuizGenerator';
import { useSpacedRepetition } from '../hooks/useSpacedRepetition';
import { useConceptMastery } from '../hooks/useConceptMastery';
import { useUserProgress } from '../hooks/useUserProgress';
import { useAdaptiveLearningEngine, MarkResult } from '../hooks/useAdaptiveLearningEngine';
import { Subject, Topic } from '../types/study';
import { supabase } from '../../integrations/supabase/client';
import { aiRequest } from '../lib/aiClient';
import { logger } from "@/utils/logger";

interface ExamQuestionPanelProps {
  question?: {
    text: string;
    marks: number;
    topic: string;
  };
  subject?: Subject;
  topic?: Topic;
  onComplete: (score: number) => void;
  onBack: () => void;
}

type Phase = 'read' | 'analyze' | 'answer' | 'marking' | 'self-assess' | 'feedback';

export function ExamQuestionPanel({
  question: staticQuestion,
  subject,
  topic,
  onComplete,
  onBack,
}: ExamQuestionPanelProps) {
  const [phase, setPhase] = useState<Phase>('read');
  const [analysis, setAnalysis] = useState({
    givenInfo: '',
    requiredAnswer: '',
    keywords: '',
    strategy: '',
  });
  const [answer, setAnswer] = useState('');
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [generatedModelAnswer, setGeneratedModelAnswer] = useState<string | null>(null);
  const [generatedKeyPoints, setGeneratedKeyPoints] = useState<string[]>([]);
  const [selfAssessment, setSelfAssessment] = useState<'correct' | 'incorrect' | null>(null);
  const [aiExplanation, setAiExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [markResult, setMarkResult] = useState<MarkResult | null>(null);
  const [isAIMarking, setIsAIMarking] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [mcqResult, setMcqResult] = useState<{ correct: boolean; correctOption: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null);
    });
  }, []);

  const { recordAttempt } = useSpacedRepetition(userId);
  const { addXp, updateStreak } = useUserProgress();
  const { checkAndUpdateMastery } = useConceptMastery();
  const { markAnswer } = useAdaptiveLearningEngine();

  // ── AI quiz generator with full syllabus context ───────────────────────────
  const quizGenerator = subject ? useQuizGenerator({ subject, topic }) : null;

  useEffect(() => {
    if (quizGenerator && !quizGenerator.question && !quizGenerator.isLoading) {
      quizGenerator.generateQuestion();
    }
  }, [quizGenerator?.isLoading, quizGenerator?.question]);

  useEffect(() => {
    if (quizGenerator?.question) {
      setGeneratedModelAnswer(quizGenerator.question.modelAnswer || null);
      setGeneratedKeyPoints(quizGenerator.question.keyPoints || []);
    }
  }, [quizGenerator?.question]);

  const activeQuestion = staticQuestion ||
    (quizGenerator?.question ? {
      text: quizGenerator.question.question,
      marks: quizGenerator.question.marks,
      topic: quizGenerator.question.topic,
    } : null);

  // ── Stream AI explanation ──────────────────────────────────────────────────
  const requestExplanation = useCallback(async () => {
    if (!activeQuestion) return;

    setIsExplaining(true);
    setExplanationError(null);
    setAiExplanation('');

    try {
      const response = await aiRequest('explain-answer', {
        question: activeQuestion.text,
        studentAnswer: answer,
        modelAnswer: generatedModelAnswer,
        topic: activeQuestion.topic,
        subject: subject?.name || 'Unknown',
        // Pass key points so the AI can reference exact marking criteria
        keyPoints: generatedKeyPoints,
        conceptsTested: quizGenerator?.question?.conceptsTested,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get explanation');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let explanationSoFar = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              explanationSoFar += content;
              setAiExplanation(explanationSoFar);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (err) {
      logger.error('Explanation error:', err);
      setExplanationError(err instanceof Error ? err.message : 'Failed to get explanation');
    } finally {
      setIsExplaining(false);
    }
  }, [activeQuestion, answer, generatedModelAnswer, generatedKeyPoints, subject?.name]);

  // ── AI Marking ─────────────────────────────────────────────────────────────
  const requestAIMarking = useCallback(async () => {
    if (!activeQuestion || !answer.trim()) return;

    setIsAIMarking(true);
    setPhase('marking');

    try {
      const result = await markAnswer(
        activeQuestion.text,
        answer,
        {
          modelAnswer: generatedModelAnswer || undefined,
          markingScheme: quizGenerator?.question?.markingScheme,
          keyPoints: generatedKeyPoints,
          totalMarks: activeQuestion.marks,
          topic: activeQuestion.topic,
          subject: subject?.name,
          conceptsTested: quizGenerator?.question?.conceptsTested,
        }
      );

      setMarkResult(result);

      // Determine if the student passed (>= 50%)
      const passed = result.percentage >= 50;
      setSelfAssessment(passed ? 'correct' : 'incorrect');

      // Record the attempt with full data
      const concepts = quizGenerator?.question?.conceptsTested || [];
      if (userId) {
        await recordAttempt(
          activeQuestion.topic,
          activeQuestion.text,
          passed,
          subject?.id,
          activeQuestion.marks,
          {
            conceptsTested: concepts,
            userAnswer: answer,
            modelAnswer: generatedModelAnswer || undefined,
            commandWord: quizGenerator?.question?.commandWord,
            marksAwarded: result.score,
            marksPossible: result.totalMarks,
          }
        );

        // Check concept mastery progression
        if (subject?.id && concepts.length > 0) {
          checkAndUpdateMastery(userId, subject.id, activeQuestion.topic, concepts);
        }
      }

      // XP: both correct and incorrect get XP, correct gets more
      const xpEarned = passed
        ? Math.max(15, Math.round(result.percentage * 0.4))
        : Math.max(5, Math.round(result.percentage * 0.15));
      addXp.mutate(xpEarned);
      updateStreak.mutate();

      // If failed, also get streaming explanation
      if (!passed) {
        requestExplanation();
      }

      setPhase('feedback');
    } catch (err) {
      logger.error('AI marking error:', err);
      // Fallback to self-assessment
      setPhase('self-assess');
    } finally {
      setIsAIMarking(false);
    }
  }, [activeQuestion, answer, generatedModelAnswer, generatedKeyPoints, subject?.name, markAnswer, userId, recordAttempt, addXp, updateStreak, requestExplanation, quizGenerator]);

  // ── Self-assessment (fallback) ─────────────────────────────────────────────
  const handleSelfAssess = async (assessment: 'correct' | 'incorrect') => {
    setSelfAssessment(assessment);

    const concepts = quizGenerator?.question?.conceptsTested || [];
    if (activeQuestion && userId) {
      await recordAttempt(
        activeQuestion.topic,
        activeQuestion.text,
        assessment === 'correct',
        subject?.id,
        activeQuestion.marks,
        {
          conceptsTested: concepts,
          userAnswer: answer,
          modelAnswer: generatedModelAnswer || undefined,
          commandWord: quizGenerator?.question?.commandWord,
        }
      );

      // Check concept mastery progression
      if (subject?.id && concepts.length > 0) {
        checkAndUpdateMastery(userId, subject.id, activeQuestion.topic, concepts);
      }
    }

    // XP: both correct and incorrect earn XP
    const xpEarned = assessment === 'correct' ? 25 : 10;
    addXp.mutate(xpEarned);
    updateStreak.mutate();

    if (assessment === 'incorrect') {
      requestExplanation();
    }
    setPhase('feedback');
  };

  // ── MCQ flow ──────────────────────────────────────────────────────────────
  const isMCQ =
    quizGenerator?.question?.questionType === 'multiple_choice' &&
    Array.isArray(quizGenerator.question.options) &&
    quizGenerator.question.options.length >= 2 &&
    !!quizGenerator.question.correctOption;

  const mcqOptions = isMCQ ? quizGenerator!.question!.options! : [];
  const mcqCorrect = isMCQ
    ? (quizGenerator!.question!.correctOption || '').toUpperCase().charAt(0)
    : '';
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const handleSubmitMCQ = async () => {
    if (!selectedOption || !activeQuestion || !isMCQ) return;
    const chosen = selectedOption.toUpperCase();
    const correct = chosen === mcqCorrect;
    const marks = activeQuestion.marks || 1;

    setMcqResult({ correct, correctOption: mcqCorrect });
    setSelfAssessment(correct ? 'correct' : 'incorrect');

    const concepts = quizGenerator?.question?.conceptsTested || [];
    if (userId) {
      await recordAttempt(
        activeQuestion.topic,
        activeQuestion.text,
        correct,
        subject?.id,
        marks,
        {
          conceptsTested: concepts,
          userAnswer: chosen,
          modelAnswer: mcqCorrect,
          commandWord: 'multiple_choice',
          marksAwarded: correct ? marks : 0,
          marksPossible: marks,
        }
      );
      if (subject?.id && concepts.length > 0) {
        checkAndUpdateMastery(userId, subject.id, activeQuestion.topic, concepts);
      }
    }

    addXp.mutate(correct ? 15 : 5);
    updateStreak.mutate();
    setPhase('feedback');
  };
  if (quizGenerator?.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 animate-fade-in gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm font-medium text-foreground">Generating exam question...</p>
        <p className="text-xs text-muted-foreground">
          {quizGenerator.hasCurriculumData
            ? '📚 Using your uploaded syllabus & past papers'
            : '⚡ Using topic knowledge'}
        </p>
        {quizGenerator.recommendedDifficulty !== 'medium' && (
          <p className="text-xs text-accent">
            Difficulty: {quizGenerator.recommendedDifficulty} (based on your performance)
          </p>
        )}
      </div>
    );
  }

  if (quizGenerator?.error) {
    return (
      <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/30 text-center animate-fade-in">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
        <p className="text-sm text-destructive mb-4">{quizGenerator.error}</p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={() => quizGenerator.generateQuestion()} className="gradient-primary">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!activeQuestion) {
    return (
      <div className="p-6 rounded-xl bg-muted/50 border border-border text-center animate-fade-in">
        <p className="text-sm text-muted-foreground">No question available</p>
        <Button variant="outline" onClick={onBack} className="mt-4">Back</Button>
      </div>
    );
  }

  const isAnalysisComplete =
    analysis.givenInfo.trim() &&
    analysis.requiredAnswer.trim() &&
    analysis.keywords.trim() &&
    analysis.strategy.trim();

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Topic test prompt (shown before the question if threshold met) */}
      {quizGenerator?.shouldTriggerTopicTest && phase === 'read' && (
        <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 flex items-start gap-3">
          <Trophy className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Topic Test Unlocked!</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You've practiced enough questions on this topic. Complete this question to evaluate your mastery.
            </p>
          </div>
        </div>
      )}

      {/* Question Header */}
      <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-destructive">
              {quizGenerator ? 'AI Exam Question' : 'Exam Question'}
            </span>
            {/* Curriculum source badges */}
            {quizGenerator?.hasCurriculumData && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">
                <BookOpen className="h-2.5 w-2.5" />
                Syllabus-based
              </span>
            )}
            {quizGenerator?.recommendedDifficulty === 'hard' && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/25">
                <Zap className="h-2.5 w-2.5" />
                Hard
              </span>
            )}
            {quizGenerator?.recommendedDifficulty === 'easy' && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/25">
                <Target className="h-2.5 w-2.5" />
                Foundation
              </span>
            )}
          </div>
          <span className="px-3 py-1 rounded-full bg-destructive/20 text-destructive text-sm font-bold">
            {activeQuestion.marks} marks
          </span>
        </div>
        <div className="text-foreground font-medium leading-relaxed prose prose-sm dark:prose-invert max-w-none">
          <MathMarkdown>{activeQuestion.text}</MathMarkdown>
        </div>
        {quizGenerator?.question?.visual && (
          <QuestionVisual visual={quizGenerator.question.visual} />
        )}
        {quizGenerator?.question?.commandWord && (
          <p className="text-xs text-muted-foreground mt-2">
            Command word: <span className="font-medium text-accent">{quizGenerator.question.commandWord}</span>
            {quizGenerator.question.conceptsTested?.length ? (
              <> · Concepts: {quizGenerator.question.conceptsTested.slice(0, 3).join(', ')}</>
            ) : null}
          </p>
        )}
      </div>

      {/* MCQ flow — bypass analyze/answer/marking phases entirely */}
      {isMCQ && phase !== 'feedback' && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Choose one answer
          </p>
          <RadioGroup
            value={selectedOption ?? ''}
            onValueChange={(v) => setSelectedOption(v)}
            className="gap-2"
          >
            {mcqOptions.map((opt, i) => {
              const letter = letters[i];
              const selected = selectedOption === letter;
              return (
                <label
                  key={letter}
                  htmlFor={`mcq-${letter}`}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                    selected
                      ? 'bg-accent/15 border-accent ring-2 ring-accent/30'
                      : 'bg-card border-border hover:border-accent/50'
                  )}
                >
                  <RadioGroupItem value={letter} id={`mcq-${letter}`} className="mt-1" />
                  <span className="flex-1 text-sm text-foreground">
                    <span className="font-bold mr-2">{letter}.</span>
                    <MathMarkdown>{String(opt)}</MathMarkdown>
                  </span>
                </label>
              );
            })}
          </RadioGroup>
          <Button
            onClick={handleSubmitMCQ}
            disabled={!selectedOption}
            className="w-full gradient-primary"
          >
            Submit Answer
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Phase: Read (non-MCQ) */}
      {!isMCQ && phase === 'read' && (
        <div className="p-4 rounded-xl bg-warning/10 border border-warning/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-foreground mb-1">Question Analysis Required</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Before answering, analyse this question carefully. Read it at least twice and identify
                the key information and what the examiner is asking.
              </p>
              <Button onClick={() => setPhase('analyze')} className="gradient-primary">
                I've Read the Question
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Phase: Analyze */}
      {phase === 'analyze' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-5 w-5 text-accent" />
              <h4 className="font-semibold text-foreground">Question Analysis Protocol</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Complete all four fields before answering. This trains systematic exam technique.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="given">Given Information</Label>
              <Textarea
                id="given"
                placeholder="What data/information is provided in the question?"
                value={analysis.givenInfo}
                onChange={(e) => setAnalysis(a => ({ ...a, givenInfo: e.target.value }))}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="required">Required Answer</Label>
              <Textarea
                id="required"
                placeholder="What exactly is the question asking you to find/explain/evaluate?"
                value={analysis.requiredAnswer}
                onChange={(e) => setAnalysis(a => ({ ...a, requiredAnswer: e.target.value }))}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords & Command Words</Label>
              <Input
                id="keywords"
                placeholder="Key terms, command words (explain/calculate/evaluate), units required"
                value={analysis.keywords}
                onChange={(e) => setAnalysis(a => ({ ...a, keywords: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="strategy">Strategy / Approach</Label>
              <Textarea
                id="strategy"
                placeholder="How will you approach this? Which method, formula, or framework?"
                value={analysis.strategy}
                onChange={(e) => setAnalysis(a => ({ ...a, strategy: e.target.value }))}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <Button
            onClick={() => setPhase('answer')}
            disabled={!isAnalysisComplete}
            className={cn(
              'w-full',
              isAnalysisComplete ? 'gradient-accent' : 'bg-muted text-muted-foreground',
            )}
          >
            {isAnalysisComplete ? 'Start Answering' : 'Complete All Fields First'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Phase: Answer */}
      {phase === 'answer' && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-success/10 border border-success/30">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-success">Analysis complete! Write your full answer.</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="answer">Your Answer</Label>
              <PhotoAnswerButton
                question={activeQuestion?.text}
                totalMarks={activeQuestion?.marks}
                subject={subject}
                topic={topic}
                onAnswer={(text) => setAnswer(answer ? `${answer}\n\n${text}` : text)}
              />
            </div>
            <Textarea
              id="answer"
              placeholder="Write your complete answer here. Show all working / reasoning steps."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="min-h-[200px]"
            />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={requestAIMarking}
              disabled={!answer.trim() || isAIMarking}
              className="flex-1 gradient-primary"
            >
              {isAIMarking ? (
                <><LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> AI Marking...</>
              ) : (
                <>Submit for AI Marking <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setPhase('self-assess')}
              disabled={!answer.trim()}
              className="flex-shrink-0"
            >
              Self-Mark
            </Button>
          </div>
        </div>
      )}

      {/* Phase: Self-Assess */}
      {phase === 'self-assess' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-success/10 border border-success/30">
            <h4 className="font-semibold text-success mb-2">Model Answer</h4>
            <div className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none">
              <MathMarkdown>{generatedModelAnswer || 'Compare your answer with the expected solution.'}</MathMarkdown>
            </div>
          </div>

          {generatedKeyPoints.length > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Marking Points</p>
              <ul className="space-y-1">
                {generatedKeyPoints.map((point, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-accent mt-0.5">•</span> {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-4 rounded-xl bg-muted/50 border border-border">
            <h4 className="font-semibold text-foreground mb-2">Your Answer</h4>
            <p className="text-sm text-foreground whitespace-pre-wrap">{answer}</p>
          </div>

          <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
            <h4 className="font-semibold text-foreground mb-3 text-center">
              Exam-style self-marking: How did you do?
            </h4>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Compare your answer against each marking point above. Be honest — it's how you improve!
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => handleSelfAssess('correct')}
                className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
              >
                <ThumbsUp className="mr-2 h-4 w-4" />
                I hit the marks
              </Button>
              <Button
                onClick={() => handleSelfAssess('incorrect')}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                <ThumbsDown className="mr-2 h-4 w-4" />
                I missed some marks
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Phase: AI Marking in progress */}
      {phase === 'marking' && (
        <div className="flex flex-col items-center justify-center py-12 animate-fade-in gap-3">
          <LoaderIcon className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm font-medium text-foreground">AI is marking your answer...</p>
          <p className="text-xs text-muted-foreground">Comparing against marking scheme and model answer</p>
        </div>
      )}

      {/* Phase: Feedback */}
      {phase === 'feedback' && (
        <div className="space-y-4">
          {/* MCQ result card with option highlighting */}
          {isMCQ && mcqResult && (
            <>
              <div className={cn(
                'p-4 rounded-xl border text-center',
                mcqResult.correct
                  ? 'bg-success/10 border-success/30'
                  : 'bg-destructive/10 border-destructive/30'
              )}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  {mcqResult.correct ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  <p className="text-sm font-semibold">
                    {mcqResult.correct ? 'Correct!' : 'Incorrect'}
                  </p>
                </div>
                <p className={cn(
                  'text-3xl font-bold',
                  mcqResult.correct ? 'text-success' : 'text-destructive',
                )}>
                  {mcqResult.correct ? activeQuestion.marks : 0}/{activeQuestion.marks}
                </p>
                <p className="text-xs text-accent mt-2">
                  +{mcqResult.correct ? 15 : 5} XP earned
                </p>
              </div>

              <div className="space-y-2">
                {mcqOptions.map((opt, i) => {
                  const letter = letters[i];
                  const isCorrect = letter === mcqResult.correctOption;
                  const isChosen = letter === selectedOption;
                  return (
                    <div
                      key={letter}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-xl border text-sm',
                        isCorrect && 'bg-success/10 border-success/40',
                        !isCorrect && isChosen && 'bg-destructive/10 border-destructive/40',
                        !isCorrect && !isChosen && 'bg-muted/40 border-border opacity-70',
                      )}
                    >
                      <span className={cn(
                        'font-bold w-5',
                        isCorrect ? 'text-success' : isChosen ? 'text-destructive' : 'text-muted-foreground',
                      )}>{letter}.</span>
                      <span className="flex-1 text-foreground">
                        <MathMarkdown>{String(opt)}</MathMarkdown>
                      </span>
                      {isCorrect && <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />}
                      {!isCorrect && isChosen && <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                    </div>
                  );
                })}
              </div>

              {quizGenerator?.question?.explanation && (
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-accent" />
                    Explanation
                  </h4>
                  <div className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none">
                    <MathMarkdown>{quizGenerator.question.explanation}</MathMarkdown>
                  </div>
                </div>
              )}
            </>
          )}

          {/* AI Mark Result (non-MCQ) */}
          {!isMCQ && markResult && (
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/30 text-center">
              <p className="text-sm text-muted-foreground mb-1">
                {markResult.percentage >= 70 ? 'Excellent!' : markResult.percentage >= 50 ? 'Good effort!' : 'Keep practicing!'}
              </p>
              <p className={cn(
                'text-4xl font-bold',
                markResult.percentage >= 70 ? 'text-success' : markResult.percentage >= 50 ? 'text-warning' : 'text-destructive',
              )}>
                {markResult.score}/{markResult.totalMarks}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{markResult.percentage}%</p>
              <p className="text-xs text-accent mt-2">
                +{Math.max(5, Math.round(markResult.percentage * 0.3))} XP earned
              </p>
            </div>
          )}
          {!isMCQ && !markResult && (
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/30 text-center">
              <p className="text-sm text-muted-foreground mb-1">
                {selfAssessment === 'correct' ? 'Great work!' : 'Keep building!'}
              </p>
              <p className={cn(
                'text-4xl font-bold',
                selfAssessment === 'correct' ? 'text-success' : 'text-warning',
              )}>
                {selfAssessment === 'correct'
                  ? `${activeQuestion.marks}/${activeQuestion.marks}`
                  : `0/${activeQuestion.marks}`}
              </p>
              <p className="text-sm text-muted-foreground mt-1">marks</p>
              <p className="text-xs text-accent mt-2">
                +{selfAssessment === 'correct' ? 25 : 10} XP earned
              </p>
            </div>
          )}

          {/* AI Marking Breakdown */}
          {markResult?.markBreakdown && markResult.markBreakdown.length > 0 && (
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Mark Breakdown</p>
              <div className="space-y-2">
                {markResult.markBreakdown.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className={cn(
                      'font-mono text-xs px-1.5 py-0.5 rounded',
                      item.marksAwarded === item.marksAvailable ? 'bg-success/15 text-success' :
                      item.marksAwarded > 0 ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive'
                    )}>
                      {item.marksAwarded}/{item.marksAvailable}
                    </span>
                    <div>
                      <span className="font-medium text-foreground">{item.criterion}</span>
                      {item.comment && <p className="text-xs text-muted-foreground mt-0.5">{item.comment}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Feedback */}
          {markResult?.feedback && (
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
              <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-accent" />
                AI Feedback
              </h4>
              <p className="text-sm text-foreground">{markResult.feedback}</p>
            </div>
          )}

          {/* Mistakes */}
          {markResult?.mistakes && markResult.mistakes.length > 0 && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
              <h4 className="font-semibold text-destructive mb-2">Mistakes to Fix</h4>
              <ul className="text-sm text-foreground space-y-1">
                {markResult.mistakes.map((m, i) => <li key={i}>• {m}</li>)}
              </ul>
            </div>
          )}

          {/* Improvement Tips */}
          {markResult?.improvementTips && markResult.improvementTips.length > 0 && (
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
              <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-accent" />
                Improvement Tips
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {markResult.improvementTips.map((tip, i) => <li key={i}>• {tip}</li>)}
              </ul>
            </div>
          )}

          {/* AI explanation when incorrect */}
          {selfAssessment === 'incorrect' && (
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-accent" />
                AI Tutor Explanation
              </h4>

              {isExplaining && !aiExplanation && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                  Analysing your answer against marking criteria...
                </div>
              )}

              {explanationError && (
                <div className="text-sm text-destructive">
                  {explanationError}
                  <Button
                    variant="link"
                    className="text-accent p-0 h-auto ml-2"
                    onClick={requestExplanation}
                  >
                    Try again
                  </Button>
                </div>
              )}

              {aiExplanation && (
                <div className="prose prose-sm max-w-none text-foreground">
                  <MathMarkdown>{aiExplanation}</MathMarkdown>
                </div>
              )}

              {isExplaining && aiExplanation && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <LoaderIcon className="h-3 w-3 animate-spin" />
                  <span>Still typing...</span>
                </div>
              )}
            </div>
          )}

          {/* Success */}
          {selfAssessment === 'correct' && (
            <div className="p-4 rounded-xl bg-success/10 border border-success/30">
              <h4 className="font-semibold text-success mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Excellent Work!
              </h4>
              <p className="text-sm text-muted-foreground">
                You demonstrated a solid understanding of {activeQuestion.topic}.
                {quizGenerator?.masteryStatus === 'mastered'
                  ? ' This topic is now mastered — well done!'
                  : ' Keep practicing to reach mastery level.'}
              </p>
            </div>
          )}

          {/* Key points */}
          <div className="p-4 rounded-xl bg-warning/10 border border-warning/30">
            <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-warning" />
              Key Points to Remember
            </h4>
            {generatedKeyPoints.length > 0 ? (
              <ul className="text-sm text-muted-foreground space-y-1">
                {generatedKeyPoints.map((point, i) => (
                  <li key={i}>• {point}</li>
                ))}
              </ul>
            ) : (
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Include units in every numerical answer</li>
                <li>• Show all working — method marks are available even if the final answer is wrong</li>
                <li>• Use precise subject terminology to signal understanding</li>
              </ul>
            )}
          </div>

          {/* Model Answer Toggle */}
          <Button
            variant="outline"
            onClick={() => setShowModelAnswer(!showModelAnswer)}
            className="w-full"
          >
            {showModelAnswer ? 'Hide' : 'Show'} Full Model Answer
          </Button>

          {showModelAnswer && (
            <div className="p-4 rounded-xl bg-success/10 border border-success/30">
              <h4 className="font-semibold text-success mb-2">Model Answer</h4>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {generatedModelAnswer || '[Model answer not available for this question]'}
              </p>
            </div>
          )}

          {/* Next question button */}
          {subject && quizGenerator && (
            <Button
              variant="outline"
              onClick={() => {
                setPhase('read');
                setAnswer('');
                setAnalysis({ givenInfo: '', requiredAnswer: '', keywords: '', strategy: '' });
                setSelfAssessment(null);
                setAiExplanation('');
                setShowModelAnswer(false);
                setMarkResult(null);
                setSelectedOption(null);
                setMcqResult(null);
                quizGenerator.clearQuestion();
                quizGenerator.generateQuestion();
              }}
              className="w-full"
            >
              Next Question
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          <Button
            onClick={() => onComplete(selfAssessment === 'correct' ? activeQuestion.marks : 0)}
            className="w-full gradient-success"
            disabled={isExplaining}
          >
            Complete Task
            <CheckCircle className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      <Button variant="ghost" onClick={onBack} className="w-full">
        Back to Tasks
      </Button>
    </div>
  );
}
