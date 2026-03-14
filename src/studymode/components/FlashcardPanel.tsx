import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, RotateCw, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { Button } from './ui/button';
import { DailyTask, Subject } from '../types/study';
import { useTaskContent } from '../hooks/useTaskContent';
import { useSyllabusContext } from '../hooks/useSyllabusContext';
import { useTopicPerformance } from '../hooks/useTopicPerformance';
import { cn } from '../lib/utils';

interface FlashcardPanelProps {
  task: DailyTask;
  subject: Subject;
  onComplete: () => void;
  onBack: () => void;
}

interface Flashcard {
  front: string;
  back: string;
}

function parseFlashcards(markdown: string): Flashcard[] {
  const cards: Flashcard[] = [];
  // Match **Front:** ... | **Back:** ... or **Front:** ... \n **Back:** ...
  const patterns = [
    /\*\*Front:\*\*\s*(.+?)\s*\|\s*\*\*Back:\*\*\s*(.+)/gi,
    /\*\*Front:\*\*\s*(.+?)\n+\s*\*\*Back:\*\*\s*(.+)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      cards.push({ front: match[1].trim(), back: match[2].trim() });
    }
  }

  // Fallback: try numbered list with Q/A pattern
  if (cards.length === 0) {
    const lines = markdown.split('\n').filter(l => l.trim());
    for (let i = 0; i < lines.length - 1; i++) {
      const frontMatch = lines[i].match(/(?:front|question|term|q)\s*[:：]\s*(.+)/i);
      const backMatch = lines[i + 1]?.match(/(?:back|answer|definition|a)\s*[:：]\s*(.+)/i);
      if (frontMatch && backMatch) {
        cards.push({
          front: frontMatch[1].replace(/\*\*/g, '').trim(),
          back: backMatch[1].replace(/\*\*/g, '').trim(),
        });
        i++;
      }
    }
  }

  return cards;
}

function FlashcardView({ card, index, total }: { card: Flashcard; index: number; total: number }) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setFlipped(false);
  }, [index]);

  return (
    <div className="flex flex-col items-center gap-4">
      <span className="text-xs text-muted-foreground font-medium">
        {index + 1} / {total}
      </span>

      <div
        className="relative w-full cursor-pointer perspective-1000"
        style={{ minHeight: 200 }}
        onClick={() => setFlipped(f => !f)}
      >
        <div
          className={cn(
            "w-full rounded-2xl border border-border shadow-lg transition-all duration-500 transform-style-3d",
            flipped && "rotate-y-180"
          )}
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.5s',
          }}
        >
          {/* Front */}
          <div
            className="p-6 rounded-2xl bg-gradient-to-br from-accent/10 to-accent/5 flex flex-col items-center justify-center text-center"
            style={{
              backfaceVisibility: 'hidden',
              minHeight: 200,
              display: flipped ? 'none' : 'flex',
            }}
          >
            <Layers className="h-5 w-5 text-accent mb-3 opacity-50" />
            <p className="text-lg font-semibold text-foreground leading-relaxed">{card.front}</p>
            <span className="text-xs text-muted-foreground mt-4">Tap to reveal answer</span>
          </div>

          {/* Back */}
          <div
            className="p-6 rounded-2xl bg-gradient-to-br from-success/10 to-success/5 flex flex-col items-center justify-center text-center"
            style={{
              backfaceVisibility: 'hidden',
              minHeight: 200,
              display: flipped ? 'flex' : 'none',
            }}
          >
            <CheckCircle2 className="h-5 w-5 text-success mb-3 opacity-50" />
            <p className="text-base text-foreground leading-relaxed">{card.back}</p>
            <span className="text-xs text-muted-foreground mt-4">Tap to see question</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FlashcardPanel({ task, subject, onComplete, onBack }: FlashcardPanelProps) {
  const { content, isLoading, error, generateContent, reset } = useTaskContent();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cards, setCards] = useState<Flashcard[]>([]);

  const {
    curriculumContext,
    examWeightFromPapers,
    pastPaperQuestions,
    isLoaded: contextLoaded,
  } = useSyllabusContext(subject.id, subject.currentTopic.name);

  const { performance } = useTopicPerformance(subject.id, subject.currentTopic.name);

  useEffect(() => {
    if (!contextLoaded) return;

    reset();
    setCurrentIndex(0);
    setCards([]);

    let performanceContext = '';
    if (performance && performance.totalAttempts > 0) {
      performanceContext = `Accuracy: ${Math.round(performance.accuracy * 100)}%. Mastery: ${performance.masteryStatus}.`;
      if (performance.weakConcepts.length > 0) {
        performanceContext += ` Reinforce these weak concepts: ${performance.weakConcepts.join(', ')}.`;
      }
    }

    generateContent({
      taskType: 'flashcards',
      subject: subject.name,
      subjectId: subject.id,
      topic: subject.currentTopic.name,
      subtopics: subject.currentTopic.subtopics,
      examWeight: examWeightFromPapers || subject.currentTopic.examWeight,
      curriculumContext: curriculumContext || undefined,
      performanceContext: performanceContext || undefined,
      masteryStatus: performance?.masteryStatus,
      difficulty: performance?.recommendedDifficulty,
    });
  }, [task.id, contextLoaded, curriculumContext, examWeightFromPapers, performance, reset, generateContent, subject.id, subject.name, subject.currentTopic.name, subject.currentTopic.examWeight, subject.currentTopic.subtopics]);

  // Parse flashcards as content streams in
  useEffect(() => {
    if (content) {
      const parsed = parseFlashcards(content);
      if (parsed.length > 0) setCards(parsed);
    }
  }, [content]);

  const goNext = useCallback(() => {
    setCurrentIndex(i => Math.min(i + 1, cards.length - 1));
  }, [cards.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex(i => Math.max(i - 1, 0));
  }, []);

  const handleRetry = () => {
    reset();
    setCards([]);
    setCurrentIndex(0);

    let performanceContext = '';
    if (performance && performance.totalAttempts > 0) {
      performanceContext = `Accuracy: ${Math.round(performance.accuracy * 100)}%. Mastery: ${performance.masteryStatus}.`;
      if (performance.weakConcepts.length > 0) {
        performanceContext += ` Reinforce these weak concepts: ${performance.weakConcepts.join(', ')}.`;
      }
    }

    generateContent({
      taskType: 'flashcards',
      subject: subject.name,
      subjectId: subject.id,
      topic: subject.currentTopic.name,
      subtopics: subject.currentTopic.subtopics,
      examWeight: examWeightFromPapers || subject.currentTopic.examWeight,
      curriculumContext: curriculumContext || undefined,
      performanceContext: performanceContext || undefined,
      masteryStatus: performance?.masteryStatus,
      difficulty: performance?.recommendedDifficulty,
    });
  };

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
            Flashcards • {subject.currentTopic.name}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-1">
        {curriculumContext && (
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

      {/* Content Area */}
      <div className="p-5 rounded-2xl bg-card border border-border min-h-[280px] flex flex-col justify-center">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Retry
            </Button>
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
                onClick={handleRetry}
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
        ) : (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">
              {!contextLoaded ? 'Loading syllabus and past-paper context...' : isLoading ? 'Generating exam-style flashcards...' : 'Preparing...'}
            </p>
          </div>
        )}
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
