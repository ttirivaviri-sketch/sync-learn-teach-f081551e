import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, RotateCw, ChevronLeft, ChevronRight, Layers, Lightbulb } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { DailyTask, Subject } from '../types/study';
import { useSyllabusContext } from '../hooks/useSyllabusContext';
import { useTopicPerformance } from '../hooks/useTopicPerformance';
import { useAdaptiveLearningEngine, Flashcard } from '../hooks/useAdaptiveLearningEngine';
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

function FlashcardView({ card, index, total }: { card: Flashcard; index: number; total: number }) {
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setFlipped(false);
    setShowHint(false);
  }, [index]);

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

      {/* Card */}
      <div
        className="relative w-full cursor-pointer"
        style={{ minHeight: 210 }}
        onClick={() => setFlipped(f => !f)}
      >
        {/* Front */}
        <div
          className={cn(
            'w-full rounded-2xl border border-border shadow-md p-6 flex flex-col items-center justify-center text-center transition-all duration-300',
            'bg-gradient-to-br from-accent/10 to-accent/5',
            flipped && 'hidden'
          )}
          style={{ minHeight: 210 }}
        >
          <Layers className="h-5 w-5 text-accent mb-3 opacity-50" />
          <p className="text-lg font-semibold text-foreground leading-relaxed">{card.front}</p>
          <span className="text-xs text-muted-foreground mt-4">Tap to reveal answer</span>
        </div>

        {/* Back */}
        <div
          className={cn(
            'w-full rounded-2xl border border-border shadow-md p-6 flex flex-col items-center justify-center text-center transition-all duration-300',
            'bg-gradient-to-br from-success/10 to-success/5',
            !flipped && 'hidden'
          )}
          style={{ minHeight: 210 }}
        >
          <CheckCircle2 className="h-5 w-5 text-success mb-3 opacity-50" />
          <p className="text-base text-foreground leading-relaxed">{card.back}</p>
          {card.hint && showHint && (
            <p className="text-xs text-muted-foreground mt-3 italic border-t border-border pt-2 w-full">
              💡 {card.hint}
            </p>
          )}
          <span className="text-xs text-muted-foreground mt-4">Tap to see question</span>
        </div>
      </div>

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
      {card.hint && flipped && (
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

  const {
    curriculumContext,
    pastPaperQuestions,
    isLoaded: contextLoaded,
  } = useSyllabusContext(subject.id, subject.currentTopic.name);

  const { performance } = useTopicPerformance(subject.id, subject.currentTopic.name);
  const { generateFlashcards } = useAdaptiveLearningEngine();

  // ── Build syllabus context string for this topic ──────────────────────────
  const syllabusContext =
    curriculumContext
      ? curriculumContext.substring(0, 1500)
      : '';

  const pastPaperContext =
    pastPaperQuestions.length > 0
      ? pastPaperQuestions
          .slice(0, 5)
          .map((q: any) =>
            `[${q.marks}m] ${q.command_words?.join(', ') || ''}: ${q.subtopic || q.topic || subject.currentTopic.name}`
          )
          .join('\n')
      : '';

  // ── Determine recommended difficulty based on performance ─────────────────
  const difficulty =
    performance?.recommendedDifficulty === 'hard'
      ? 'hard'
      : performance?.recommendedDifficulty === 'easy'
      ? 'easy'
      : 'mixed';

  // ── Persist flashcards to Supabase ────────────────────────────────────────
  const persistCards = useCallback(async (newCards: Flashcard[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upsert cards (keyed on user_id + subject + topic + front)
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
        console.warn('[FlashcardPanel] Persist error (table may not exist yet):', upsertErr.message);
      }
    } catch (err) {
      console.warn('[FlashcardPanel] Persist failed:', err);
    }
  }, [subject]);

  // ── Fetch flashcards ──────────────────────────────────────────────────────
  const fetchCards = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setCurrentIndex(0);
    setCards([]);

    try {
      const newCards = await generateFlashcards(subject.name, subject.currentTopic.name, {
        count: 8,
        difficulty,
      });

      if (newCards.length === 0) {
        setError('No flashcards generated. Try again.');
      } else {
        setCards(newCards);
        // Persist in background — don't block the UI
        persistCards(newCards).catch(() => {});
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards');
    } finally {
      setIsLoading(false);
    }
  }, [generateFlashcards, subject.name, subject.currentTopic.name, difficulty, persistCards]);

  // Trigger on mount (after syllabus context loads)
  useEffect(() => {
    if (!contextLoaded) return;
    fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div>
          <h3 className="text-lg font-bold text-foreground">{task.title}</h3>
          <p className="text-sm text-muted-foreground">
            Flashcards · {subject.currentTopic.name}
          </p>
        </div>
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
        {performance?.masteryStatus === 'mastered' && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
            ✓ Topic mastered
          </span>
        )}
        {performance?.masteryStatus === 'struggling' && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
            ⚠ Needs work
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
              {!contextLoaded
                ? 'Loading syllabus context…'
                : 'Generating exam-style flashcards…'}
            </p>
          </div>
        ) : cards.length > 0 ? (
          <>
            <FlashcardView card={cards[currentIndex]} index={currentIndex} total={cards.length} />

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchCards}
                disabled={isLoading}
                className="gap-1"
              >
                <RotateCw className="h-4 w-4" /> New Set
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={goNext}
                disabled={currentIndex === cards.length - 1}
                className="gap-1"
              >
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
