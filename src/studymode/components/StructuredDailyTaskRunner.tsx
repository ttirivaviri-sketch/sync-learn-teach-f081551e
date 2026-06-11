import { useState } from 'react';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, RefreshCw, Eye, Send, Layers, RotateCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { MathMarkdown } from './MathMarkdown';
import { useStructuredDailyTask, PracticeQuestion, FlashcardItem } from '../hooks/useStructuredDailyTask';
import { useUserProgress } from '../hooks/useUserProgress';
import { useSubjectXP } from '../hooks/useSubjectXP';
import { useDailyTaskAttempts } from '../hooks/useDailyTaskAttempts';
import { DailyTask, Subject } from '../types/study';
import { cn } from '@/lib/utils';
import { studySyncHaptic } from '@/lib/haptics';

interface Props {
  task: DailyTask;
  subject: Subject;
  curriculum?: string | null;
  onComplete: () => void;
  onBack: () => void;
}

const DIFFICULTY_XP = { easy: 3, medium: 5, hard: 8 } as const;
const DIFFICULTY_XP_REPLAY = { easy: 2, medium: 3, hard: 5 } as const;
const EXAM_XP = 10;
const EXAM_XP_REPLAY = 5;

export function StructuredDailyTaskRunner({ task: dailyTask, subject, curriculum, onComplete, onBack }: Props) {
  const { addXp, updateStreak } = useUserProgress();
  const { awardXP } = useSubjectXP();
  const { logAttempt } = useDailyTaskAttempts();
  const isReplay = !!dailyTask.isCompleted;
  const xpMap = isReplay ? DIFFICULTY_XP_REPLAY : DIFFICULTY_XP;
  const examXp = isReplay ? EXAM_XP_REPLAY : EXAM_XP;

  const { task, isLoading, error, coverageWarnings, regenerate, regenCount, maxRegen, dailyTaskRowId } = useStructuredDailyTask({
    subjectId: subject.id,
    subjectName: subject.name,
    topic: subject.currentTopic.name,
    subtopics: subject.currentTopic.subtopics,
    availableConcepts: subject.currentTopic.subtopics,
  });
  const regenExhausted = regenCount >= maxRegen;

  const [step, setStep] = useState<'learn' | 'review' | 'flashcards' | 'practice' | 'exam'>('learn');
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<number, string>>({});
  const [practiceRevealed, setPracticeRevealed] = useState<Record<number, boolean>>({});
  const [practiceCorrect, setPracticeCorrect] = useState<Record<number, boolean>>({});
  const [examAnswer, setExamAnswer] = useState('');
  const [examRevealed, setExamRevealed] = useState(false);
  const [examChecks, setExamChecks] = useState<Record<number, boolean>>({});
  const [flashIdx, setFlashIdx] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState<Record<number, boolean>>({});
  const [flashGraded, setFlashGraded] = useState<Record<number, 'correct' | 'wrong'>>({});

  const handleRegenerate = async () => {
    const result = await regenerate();
    if (result?.ok) {
      toast.success(`New task generated (${result.regenCount}/${maxRegen} today)`);
    } else if ((result as any)?.limited) {
      toast.error('Daily regenerate limit reached', {
        description: `You've used all ${maxRegen} regenerations for today. Try again tomorrow.`,
      });
    } else if ((result as any)?.message) {
      toast.error('Regeneration failed', { description: (result as any).message });
    }
  };

  if (isLoading || (!task && !error)) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted-foreground">Building your syllabus-grounded task…</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error ?? 'No task could be generated.'}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={handleRegenerate}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
        </div>
      </div>
    );
  }

  const practice = task.blocks.practice_questions;
  const currentQ: PracticeQuestion | undefined = practice[practiceIdx];

  const submitPractice = () => {
    if (!currentQ) return;
    const ans = (practiceAnswers[practiceIdx] ?? '').trim().toLowerCase();
    const expected = (currentQ.answer ?? '').trim().toLowerCase();
    const correct = ans.length > 0 && (ans === expected || expected.includes(ans) || ans.includes(expected.slice(0, Math.max(8, Math.floor(expected.length * 0.6)))));
    setPracticeRevealed((p) => ({ ...p, [practiceIdx]: true }));
    setPracticeCorrect((p) => ({ ...p, [practiceIdx]: correct }));
    if (correct) {
      const xp = xpMap[currentQ.difficulty] ?? (isReplay ? 3 : 5);
      addXp.mutate(xp);
      awardXP.mutate({ subject: subject.name, curriculum, amount: xp });
      if (!isReplay) updateStreak.mutate();
    }
    logAttempt({
      dailyTaskId: dailyTaskRowId,
      subjectId: subject.id,
      subjectName: subject.name,
      topic: task?.topic || subject.currentTopic.name,
      concept: currentQ.concept,
      question: currentQ.question,
      userAnswer: practiceAnswers[practiceIdx] ?? '',
      modelAnswer: currentQ.answer,
      wasCorrect: correct,
      marksAwarded: correct ? currentQ.marks : 0,
      marksPossible: currentQ.marks,
      difficulty: currentQ.difficulty,
      block: 'practice',
    });
  };

  const revealPractice = () => {
    setPracticeRevealed((p) => ({ ...p, [practiceIdx]: true }));
    setPracticeCorrect((p) => ({ ...p, [practiceIdx]: false }));
    if (currentQ) {
      logAttempt({
        dailyTaskId: dailyTaskRowId,
        subjectId: subject.id,
        subjectName: subject.name,
        topic: task?.topic || subject.currentTopic.name,
        concept: currentQ.concept,
        question: currentQ.question,
        userAnswer: practiceAnswers[practiceIdx] ?? '',
        modelAnswer: currentQ.answer,
        wasCorrect: false,
        marksAwarded: 0,
        marksPossible: currentQ.marks,
        difficulty: currentQ.difficulty,
        block: 'practice',
      });
    }
  };

  const nextPractice = () => {
    if (practiceIdx < practice.length - 1) setPracticeIdx(practiceIdx + 1);
    else setStep('exam');
  };

  const submitExam = () => {
    setExamRevealed(true);
    addXp.mutate(examXp);
    awardXP.mutate({ subject: subject.name, curriculum, amount: examXp });
    if (!isReplay) updateStreak.mutate();
    if (task) {
      logAttempt({
        dailyTaskId: dailyTaskRowId,
        subjectId: subject.id,
        subjectName: subject.name,
        topic: task.topic || subject.currentTopic.name,
        concept: (task.blocks.exam_question.concepts ?? []).join(', ') || null,
        question: task.blocks.exam_question.question,
        userAnswer: examAnswer,
        modelAnswer: (task.blocks.exam_question.expected_steps ?? []).join('\n'),
        wasCorrect: false, // graded by checkbox steps after reveal
        marksAwarded: 0,
        marksPossible: task.blocks.exam_question.marks,
        difficulty: 'hard',
        block: 'exam',
      });
    }
  };

  const allExamStepsChecked =
    task.blocks.exam_question.expected_steps.length > 0 &&
    task.blocks.exam_question.expected_steps.every((_, i) => examChecks[i]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-foreground truncate">📚 {dailyTask.title}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {task.topic}{task.subtopic ? ` · ${task.subtopic}` : ''}
          </p>
          {isReplay && (
            <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
              Replay practice — reduced XP
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRegenerate}
          disabled={regenExhausted}
          title={regenExhausted ? `Daily limit reached (${maxRegen}/day)` : `Regenerate (${regenCount}/${maxRegen})`}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Concept chips */}
      {task.concepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {task.concepts.map((c) => (
            <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
              {c}
            </span>
          ))}
        </div>
      )}

      {coverageWarnings.length > 0 && (
        <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 text-xs text-warning">
          <p className="font-semibold mb-1">⚠️ Partial coverage</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {coverageWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex gap-1">
        {(['learn', 'review', 'flashcards', 'practice', 'exam'] as const).map((s, i) => (
          <div
            key={s}
            className={cn(
              'flex-1 h-1.5 rounded-full transition-colors',
              step === s
                ? 'bg-primary'
                : (['learn', 'review', 'flashcards', 'practice', 'exam'] as const).indexOf(step) > i
                ? 'bg-success'
                : 'bg-muted',
            )}
          />
        ))}
      </div>

      {regenExhausted && (
        <p className="text-xs text-muted-foreground -mt-1">
          Daily regenerate limit reached ({maxRegen}/{maxRegen}). Resets at midnight.
        </p>
      )}

      {/* Block 1: Concept Learning */}
      {step === 'learn' && (
        <div className="space-y-3">
          <div className="p-5 rounded-2xl bg-card border border-border">
            <p className="text-xs font-bold uppercase tracking-wide text-accent mb-2">Concept Learning</p>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MathMarkdown>{task.blocks.concept_learning}</MathMarkdown>
            </div>
          </div>
          <Button onClick={() => setStep('review')} className="w-full">Continue to Quick Review</Button>
        </div>
      )}

      {/* Block 2: Quick Review */}
      {step === 'review' && (
        <div className="space-y-3">
          <div className="p-5 rounded-2xl bg-card border border-border">
            <p className="text-xs font-bold uppercase tracking-wide text-accent mb-2">Quick Review</p>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MathMarkdown>{task.blocks.quick_review}</MathMarkdown>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('learn')} className="flex-1">Back</Button>
            <Button onClick={() => setStep((task.blocks.flashcards?.length ?? 0) > 0 ? 'flashcards' : 'practice')} className="flex-1">
              {(task.blocks.flashcards?.length ?? 0) > 0 ? 'Continue to Flashcards' : 'Start Practice'}
            </Button>
          </div>
        </div>
      )}

      {/* Block 2.5: Flashcards (feeds quiz_attempts spaced-repetition) */}
      {step === 'flashcards' && (task.blocks.flashcards?.length ?? 0) > 0 && (() => {
        const cards = task.blocks.flashcards ?? [];
        const card: FlashcardItem = cards[flashIdx];
        const flipped = !!flashFlipped[flashIdx];
        const graded = flashGraded[flashIdx];
        const gradeCard = (knew: boolean) => {
          setFlashGraded((p) => ({ ...p, [flashIdx]: knew ? 'correct' : 'wrong' }));
          const xp = knew ? (isReplay ? 1 : 2) : 0;
          if (xp > 0) {
            addXp.mutate(xp);
            awardXP.mutate({ subject: subject.name, curriculum, amount: xp });
          }
          logAttempt({
            dailyTaskId: dailyTaskRowId,
            subjectId: subject.id,
            subjectName: subject.name,
            topic: task.topic || subject.currentTopic.name,
            concept: card.concept ?? null,
            question: card.front,
            userAnswer: knew ? '(self-graded: knew it)' : '(self-graded: did not know)',
            modelAnswer: card.back,
            wasCorrect: knew,
            marksAwarded: knew ? 1 : 0,
            marksPossible: 1,
            difficulty: 'easy',
            block: 'flashcard',
          });
        };
        const nextCard = () => {
          if (flashIdx < cards.length - 1) setFlashIdx(flashIdx + 1);
          else setStep('practice');
        };
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> Flashcard {flashIdx + 1} of {cards.length}</span>
              {card.concept && <span className="px-2 py-0.5 rounded-full bg-muted">{card.concept}</span>}
            </div>
            <div
              className={cn(
                'p-6 rounded-2xl border min-h-[160px] flex items-center justify-center text-center cursor-pointer transition-all',
                flipped ? 'bg-accent/10 border-accent/40' : 'bg-card border-border hover:border-accent/30',
              )}
              onClick={() => setFlashFlipped((p) => ({ ...p, [flashIdx]: !p[flashIdx] }))}
            >
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <MathMarkdown>{flipped ? card.back : card.front}</MathMarkdown>
              </div>
            </div>
            {card.hint && !flipped && (
              <p className="text-xs text-muted-foreground text-center">💡 {card.hint}</p>
            )}
            {!flipped ? (
              <Button variant="outline" className="w-full" onClick={() => setFlashFlipped((p) => ({ ...p, [flashIdx]: true }))}>
                <RotateCw className="mr-2 h-4 w-4" />Flip card
              </Button>
            ) : !graded ? (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => gradeCard(false)}>
                  <ThumbsDown className="mr-2 h-4 w-4" />Didn't know
                </Button>
                <Button className="flex-1" onClick={() => gradeCard(true)}>
                  <ThumbsUp className="mr-2 h-4 w-4" />I knew it
                </Button>
              </div>
            ) : (
              <Button className="w-full" onClick={nextCard}>
                {flashIdx < cards.length - 1 ? 'Next card' : 'Continue to Practice'}
              </Button>
            )}
          </div>
        );
      })()}

      {/* Block 3: Practice Questions */}
      {step === 'practice' && currentQ && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Question {practiceIdx + 1} of {practice.length}</span>
            <span className="flex gap-2">
              <span className="px-2 py-0.5 rounded-full bg-muted">{currentQ.difficulty}</span>
              <span className="px-2 py-0.5 rounded-full bg-muted">{currentQ.marks} mark{currentQ.marks !== 1 ? 's' : ''}</span>
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
            <p className="text-xs font-semibold text-accent">{currentQ.concept}</p>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MathMarkdown>{currentQ.question}</MathMarkdown>
            </div>

            <Textarea
              placeholder="Your answer…"
              value={practiceAnswers[practiceIdx] ?? ''}
              onChange={(e) => setPracticeAnswers((p) => ({ ...p, [practiceIdx]: e.target.value }))}
              disabled={practiceRevealed[practiceIdx]}
              className="min-h-[80px] text-sm"
            />

            {practiceRevealed[practiceIdx] && (
              <div className={cn(
                'p-3 rounded-lg border text-sm',
                practiceCorrect[practiceIdx]
                  ? 'border-success/30 bg-success/10'
                  : 'border-destructive/30 bg-destructive/10',
              )}>
                <p className="font-semibold mb-1">
                  {practiceCorrect[practiceIdx] ? `✅ Correct (+${xpMap[currentQ.difficulty]} XP)` : '📖 Model Answer'}
                </p>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MathMarkdown>{currentQ.answer}</MathMarkdown>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!practiceRevealed[practiceIdx] ? (
              <>
                <Button variant="outline" onClick={revealPractice} className="flex-1">
                  <Eye className="mr-2 h-4 w-4" />Reveal
                </Button>
                <Button
                  onClick={submitPractice}
                  disabled={!(practiceAnswers[practiceIdx] ?? '').trim()}
                  className="flex-1"
                >
                  <Send className="mr-2 h-4 w-4" />Submit
                </Button>
              </>
            ) : (
              <Button onClick={nextPractice} className="w-full">
                {practiceIdx < practice.length - 1 ? 'Next Question' : 'Continue to Exam Question'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Block 4: Exam Question */}
      {step === 'exam' && (
        <div className="space-y-3">
          <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-accent">Exam Question</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                {task.blocks.exam_question.marks} marks
              </span>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MathMarkdown>{task.blocks.exam_question.question}</MathMarkdown>
            </div>

            <Textarea
              placeholder="Write your full multi-step answer…"
              value={examAnswer}
              onChange={(e) => setExamAnswer(e.target.value)}
              disabled={examRevealed}
              className="min-h-[140px] text-sm"
            />

            {examRevealed && (
              <div className="p-3 rounded-lg border border-accent/30 bg-accent/5 space-y-2">
                <p className="text-xs font-semibold text-accent">Mark-scheme steps — tick what you covered:</p>
                {task.blocks.exam_question.expected_steps.map((s, i) => (
                  <label key={i} className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={examChecks[i] ?? false}
                      onCheckedChange={(v) => setExamChecks((p) => ({ ...p, [i]: !!v }))}
                      className="mt-0.5"
                    />
                    <span className="flex-1">{s}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {!examRevealed ? (
            <Button onClick={submitExam} disabled={!examAnswer.trim()} className="w-full">
              <Send className="mr-2 h-4 w-4" />Submit & Reveal Mark Scheme (+{examXp} XP)
            </Button>
          ) : (
            <Button
              onClick={onComplete}
              className="w-full bg-success hover:bg-success/90 text-success-foreground"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {allExamStepsChecked ? 'Mark Complete' : 'Mark Complete (review missed steps later)'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
