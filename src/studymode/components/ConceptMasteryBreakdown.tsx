import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import { cn } from '../lib/utils';

interface ConceptMasteryBreakdownProps {
  subjectId: string;
  topicName: string;
}

interface ConceptStatus {
  concept: string;
  correctCount: number;
  distinctDays: number;
  isMastered: boolean;
}

const MASTERY_THRESHOLD = 3;

export function ConceptMasteryBreakdown({ subjectId, topicName }: ConceptMasteryBreakdownProps) {
  const [concepts, setConcepts] = useState<ConceptStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setIsLoading(false); return; }

      const { data: attempts } = await supabase
        .from('quiz_attempts' as any)
        .select('concepts_tested, was_correct, created_at')
        .eq('user_id', user.id)
        .eq('subject_id', subjectId)
        .ilike('topic_name', `%${topicName}%`);

      if (cancelled) return;
      if (!attempts || attempts.length === 0) {
        setConcepts([]);
        setIsLoading(false);
        return;
      }

      // Build per-concept stats
      const conceptMap = new Map<string, { correctDates: string[]; totalCorrect: number }>();

      for (const attempt of attempts as any[]) {
        const tested: string[] = attempt.concepts_tested || [];
        for (const raw of tested) {
          const c = raw.toLowerCase().trim();
          if (!c) continue;
          if (!conceptMap.has(c)) conceptMap.set(c, { correctDates: [], totalCorrect: 0 });
          const entry = conceptMap.get(c)!;
          if (attempt.was_correct) {
            entry.totalCorrect++;
            entry.correctDates.push((attempt.created_at as string).split('T')[0]);
          }
        }
      }

      const result: ConceptStatus[] = [];
      for (const [concept, stats] of conceptMap) {
        const distinctDays = new Set(stats.correctDates).size;
        const isMastered = stats.totalCorrect >= MASTERY_THRESHOLD && distinctDays >= 2;
        result.push({
          concept,
          correctCount: stats.totalCorrect,
          distinctDays,
          isMastered,
        });
      }

      // Sort: mastered first, then by progress
      result.sort((a, b) => {
        if (a.isMastered !== b.isMastered) return a.isMastered ? -1 : 1;
        return b.correctCount - a.correctCount;
      });

      setConcepts(result);
      setIsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [subjectId, topicName]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading concept breakdown…
      </div>
    );
  }

  if (concepts.length === 0) {
    return (
      <div className="py-3 text-sm text-muted-foreground italic">
        No concept data yet — complete quizzes and flashcards to track mastery.
      </div>
    );
  }

  const masteredCount = concepts.filter(c => c.isMastered).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Concept Mastery
        </p>
        <span className="text-xs text-muted-foreground">
          {masteredCount}/{concepts.length} mastered
        </span>
      </div>

      <div className="space-y-2">
        {concepts.map((c) => (
          <div
            key={c.concept}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg border text-sm",
              c.isMastered
                ? "bg-success/5 border-success/20"
                : c.correctCount > 0
                ? "bg-warning/5 border-warning/20"
                : "bg-muted/30 border-border"
            )}
          >
            {c.isMastered ? (
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            ) : c.correctCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
            )}

            <span className="flex-1 capitalize text-foreground truncate">
              {c.concept}
            </span>

            <div className="flex items-center gap-1 shrink-0">
              {/* Show 3 dots representing the 3 required correct attempts */}
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={cn(
                    "h-2 w-2 rounded-full",
                    i < c.correctCount
                      ? c.isMastered ? "bg-success" : "bg-warning"
                      : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        3 correct answers across 2+ days = mastered ✓
      </p>
    </div>
  );
}
