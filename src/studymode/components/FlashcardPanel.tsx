import { useEffect, useState, useCallback, useRef } from 'react';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, RotateCw, ChevronLeft, ChevronRight, Layers, Lightbulb, Send, MinusCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { MathMarkdown } from './MathMarkdown';
import { DailyTask, Subject } from '../types/study';
import { useSyllabusContext } from '../hooks/useSyllabusContext';
import { useTopicPerformance } from '../hooks/useTopicPerformance';
import { useAdaptiveLearningEngine, Flashcard } from '../hooks/useAdaptiveLearningEngine';
import { useConceptMastery } from '../hooks/useConceptMastery';
import { useUserProgress } from '../hooks/useUserProgress';
import { useSpacedRepetition } from '../hooks/useSpacedRepetition';
import { supabase } from '../../integrations/supabase/client';
import { cn } from '../lib/utils';

interface FlashcardPanelProps {
  task: DailyTask;
  subject: Subject;
  onComplete: () => void;
  onBack: () => void;
}

const difficultyColors: Record<string, string> = {
  easy:   'bg-success/15 text-success border-success/30',
  medium: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  hard:   'bg-destructive/15 text-destructive border-destructive/30',
};

interface FlashcardViewProps {
  card: Flashcard;
  index: number;
  total: number;
  onResult: (answered: boolean, skipped: boolean) => void;
}

function FlashcardView({ card, index, total, onResult }: FlashcardViewProps) {
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [hasAttempted, setHasAttempted] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setFlipped(false);
    setShowHint(false);
    setUserAnswer('');
    setHasAttempted(false);
    setSkipped(false);
  }, [index]);

  const handleSubmitAnswer = () => {
    setHasAttempted(true);
    setSkipped(false);
    setFlipped(true);
    onResult(true, false);
  };

  const handleSkip = () => {
    setHasAttempted(true);
    setSkipped(true);
    setFlipped(true);
    onResult(false, true);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Progress + difficulty */}
      <div className="flex items-center justify-between w-full px-1">
        <span className="text-xs text-muted-foreground font-medium">
          {index + 1} / {total}
        </span>
        <Badge
          variant="outline"
          className={cn('text-xs', difficultyColors[card.difficulty] || difficultyColors.medium)}
        >
          {card.difficulty}
        </Badge>
      </div>

      {/* Question (always visible) */}
      <div
        className="w-full rounded-2xl border border-border shadow-md p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-accent/10 to-accent/5"
        style={{ minHeight: 180 }}
      >
        <Layers className="h-5 w-5 text-accent mb-3 opacity-50" />
        <div className="text-lg font-semibold text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none">
          <MathMarkdown>{card.front}</MathMarkdown>
        </div>
      </div>

      {/* Answer input (before attempting) */}
      {!hasAttempted && (
        <div className="w-full space-y-3">
          <Textarea
            ref={textareaRef}
            placeholder="Type your answer before revealing..."
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            className="min-h-[80px] text-sm"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSubmitAnswer}
              disabled={!userAnswer.trim()}
              className="flex-1 gradient-primary"
              size="sm"
            >
              <Send className="mr-2 h-3.5 w-3.5" />
              Check Answer
            </Button>
            <Button
              variant="outline"
              onClick={handleSkip}
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <MinusCircle className="mr-1 h-3.5 w-3.5" />
              Skip (−5 XP)
            </Button>
          </div>
        </div>
      )}

      {/* Revealed answer (after attempting) */}
      {hasAttempted && flipped && (
        <div className="w-full space-y-3">
          {/* XP indicator */}
          {skipped && (
            <div className="text-center text-xs text-destructive font-medium">
              −5 XP (revealed without attempting)
            </div>
          )}

          {/* Student's answer */}
          {userAnswer.trim() && (
            <div className="w-full rounded-xl border border-border p-4 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Your Answer</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{userAnswer}</p>
            </div>
          )}

          {/* Correct answer */}
          <div
            className="w-full rounded-2xl border border-success/30 shadow-md p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-success/10 to-success/5"
            style={{ minHeight: 160 }}
          >
            <CheckCircle2 className="h-5 w-5 text-success mb-3 opacity-50" />
            <div className="text-base text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none">
              <MathMarkdown>{card.back}</MathMarkdown>
            </div>
            {card.hint && showHint && (
              <p className="text-xs text-muted-foreground mt-3 italic border-t border-border pt-2 w-full">
                💡 {card.hint}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center">
          {card.tags.slice(0, 4).map(tag => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Hint toggle */}
      {card.hint && hasAttempted && flipped && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs text-muted-foreground"
          onClick={(e) => { e.stopPropagation(); setShowHint(h => !h); }}
        >
          <Lightbulb className="h-3 w-3" />
          {showHint ? 'Hide hint' : 'Show hint'}
        </Button>
      )}
    </div>
  );
}

export function FlashcardPanel({ task, subject, onComplete, onBack }: FlashcardPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [totalXpEarned, setTotalXpEarned] = useState(0);

  const {
    curriculumContext,
    pastPaperQuestions,
    isLoaded: contextLoaded,
  } = useSyllabusContext(subject.id, subject.currentTopic.name);

  const { performance } = useTopicPerformance(subject.id, subject.currentTopic.name);
  const { generateFlashcards } = useAdaptiveLearningEngine();
  const { addXp, updateStreak } = useUserProgress();
  const { checkAndUpdateMastery } = useConceptMastery();
  const { recordAttempt } = useSpacedRepetition(userId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null);
    });
  }, []);

  const syllabusContext = curriculumContext ? curriculumContext.substring(0, 1500) : '';

  const difficulty =
    performance?.recommendedDifficulty === 'hard' ? 'hard'
    : performance?.recommendedDifficulty === 'easy' ? 'easy'
    : 'mixed';

  // ── Persist flashcards to Supabase ────────────────────────────────────────
  const persistCards = useCallback(async (newCards: Flashcard[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const rows = newCards.map(c => ({
        user_id: user.id,
        subject: subject.name,
        subject_id: subject.id || null,
        topic: subject.currentTopic.name,
        front: c.front,
        back: c.back,
        hint: c.hint || null,
        difficulty: c.difficulty,
        tags: c.tags,
      }));

      const { error: upsertErr } = await (supabase as any)
        .from('flashcards')
        .upsert(rows, { onConflict: 'user_id,subject,topic,front', ignoreDuplicates: true });

      if (upsertErr) {
        console.warn('[FlashcardPanel] Persist error:', upsertErr.message);
      }
    } catch (err) {
      console.warn('[FlashcardPanel] Persist failed:', err);
    }
  }, [subject]);

  // ── Handle card result (answered or skipped) ──────────────────────────────
  const handleCardResult = useCallback(async (answered: boolean, skipped: boolean) => {
    const card = cards[currentIndex];
    if (!card || !userId) return;

    const concepts = card.tags || [];

    if (skipped) {
      // Negative XP for skipping
      addXp.mutate(-5);
      setTotalXpEarned(prev => prev - 5);
    } else {
      // Positive XP for attempting (we treat flashcard attempt as correct since they self-reviewed)
      addXp.mutate(15);
      setTotalXpEarned(prev => prev + 15);
      updateStreak.mutate();

      // Record as a quiz attempt for concept mastery tracking
      await recordAttempt(
        subject.currentTopic.name,
        card.front,
        true, // treated as correct since they attempted
        subject.id,
        1,
        {
          conceptsTested: concepts,
          userAnswer: 'flashcard-attempt',
          modelAnswer: card.back,
        }
      );

      // Check concept mastery progression
      if (subject.id && concepts.length > 0) {
        checkAndUpdateMastery(userId, subject.id, subject.currentTopic.name, concepts);
      }
    }
  }, [cards, currentIndex, userId, subject, addXp, updateStreak, recordAttempt, checkAndUpdateMastery]);

  // ── Fetch flashcards ──────────────────────────────────────────────────────
  const fetchCards = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setCurrentIndex(0);
    setCards([]);
    setTotalXpEarned(0);

    try {
      const newCards = await generateFlashcards(subject.name, subject.currentTopic.name, {
        count: 8,
        difficulty,
      });

      if (newCards.length === 0) {
        setError('No flashcards generated. Try again.');
      } else {
        setCards(newCards);
        persistCards(newCards).catch(() => {});
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards');
    } finally {
      setIsLoading(false);
    }
  }, [generateFlashcards, subject.name, subject.currentTopic.name, difficulty, persistCards]);

  useEffect(() => {
    if (!contextLoaded) return;
    fetchCards();
  }, [contextLoaded, subject.id, subject.currentTopic.name]);

  const goNext = useCallback(() => {
    setCurrentIndex(i => Math.min(i + 1, cards.length - 1));
  }, [cards.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex(i => Math.max(i - 1, 0));
  }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground">{task.title}</h3>
          <p className="text-sm text-muted-foreground">
            Flashcards · {subject.currentTopic.name}
          </p>
        </div>
        {totalXpEarned !== 0 && (
          <span className={cn(
            "text-xs font-bold px-2 py-1 rounded-full",
            totalXpEarned > 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
          )}>
            {totalXpEarned > 0 ? '+' : ''}{totalXpEarned} XP
          </span>
        )}
      </div>

      {/* Context badges */}
      <div className="flex flex-wrap gap-2 px-1">
        {syllabusContext && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
            📚 Syllabus aligned
          </span>
        )}
        {pastPaperQuestions.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
            📝 {pastPaperQuestions.length} past-paper patterns
          </span>
        )}
      </div>

      {/* Card Area */}
      <div className="p-5 rounded-2xl bg-card border border-border min-h-[280px] flex flex-col justify-center">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchCards}>
              Retry
            </Button>
          </div>
        ) : isLoading || !contextLoaded ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">
              {!contextLoaded ? 'Loading syllabus context…' : 'Generating exam-style flashcards…'}
            </p>
          </div>
        ) : cards.length > 0 ? (
          <>
            <FlashcardView
              card={cards[currentIndex]}
              index={currentIndex}
              total={cards.length}
              onResult={handleCardResult}
            />

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <Button variant="outline" size="sm" onClick={goPrev} disabled={currentIndex === 0} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button variant="outline" size="sm" onClick={fetchCards} disabled={isLoading} className="gap-1">
                <RotateCw className="h-4 w-4" /> New Set
              </Button>
              <Button variant="outline" size="sm" onClick={goNext} disabled={currentIndex === cards.length - 1} className="gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          onClick={onComplete}
          disabled={cards.length === 0}
          className="flex-1 gap-2 bg-success hover:bg-success/90 text-success-foreground"
        >
          <CheckCircle2 className="h-4 w-4" />
          Mark Complete
        </Button>
      </div>
    </div>
  );
}
