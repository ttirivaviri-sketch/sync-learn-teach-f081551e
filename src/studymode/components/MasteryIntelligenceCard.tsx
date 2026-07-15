/**
 * MasteryIntelligenceCard
 *
 * Compact concept-level mastery snapshot for a subject: strongest and
 * weakest concepts plus recent evidence, sourced from the LOS concept
 * mastery ledger via useMasteryIntelligence. Referenced by
 * LearningOpsOverview; renders a quiet empty state when no evidence exists.
 */
import { Brain, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMasteryIntelligence } from '../hooks/useMasteryIntelligence';
import type { ConceptMasteryRollup } from '../lib/learningOps';

interface MasteryIntelligenceCardProps {
  subjectId?: string;
  subjectName?: string;
}

function ConceptRow({ rollup, tone }: { rollup: ConceptMasteryRollup; tone: 'strong' | 'weak' }) {
  const pct = Math.round(Math.max(0, Math.min(1, rollup.confidenceScore)) * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      {tone === 'strong' ? (
        <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5 text-destructive shrink-0" />
      )}
      <span className="flex-1 truncate text-foreground">{rollup.conceptName}</span>
      <span className="text-muted-foreground truncate max-w-[35%]">{rollup.topicName}</span>
      <span
        className={cn(
          'font-semibold tabular-nums',
          tone === 'strong' ? 'text-emerald-600' : 'text-destructive',
        )}
      >
        {pct}%
      </span>
    </div>
  );
}

export function MasteryIntelligenceCard({ subjectId, subjectName }: MasteryIntelligenceCardProps) {
  const { strongest, weakest, recentEvidence, isLoading, error } = useMasteryIntelligence({
    subjectId,
    subjectName,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading mastery intelligence…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Mastery intelligence unavailable: {error}
      </div>
    );
  }

  const hasData = strongest.length > 0 || weakest.length > 0 || recentEvidence.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Mastery Intelligence</h3>
      </div>

      {!hasData ? (
        <p className="text-xs text-muted-foreground">
          No concept evidence yet{subjectName ? ` for ${subjectName}` : ''}. Complete practice
          sessions, active recall, or exams to build your mastery ledger.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Strongest concepts
            </p>
            {strongest.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing solid yet — keep practising.</p>
            ) : (
              strongest.slice(0, 4).map((rollup) => (
                <ConceptRow key={`s-${rollup.conceptName}`} rollup={rollup} tone="strong" />
              ))
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Needs attention
            </p>
            {weakest.length === 0 ? (
              <p className="text-xs text-muted-foreground">No weak spots detected.</p>
            ) : (
              weakest.slice(0, 4).map((rollup) => (
                <ConceptRow key={`w-${rollup.conceptName}`} rollup={rollup} tone="weak" />
              ))
            )}
          </div>
        </div>
      )}

      {recentEvidence.length > 0 && (
        <div className="pt-2 border-t border-border/60">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
            Latest evidence
          </p>
          <div className="space-y-1">
            {recentEvidence.slice(0, 3).map((item, idx) => (
              <p key={idx} className="text-xs text-muted-foreground truncate">
                <span className="text-foreground">{item.concept_name}</span> · {item.evidence_type}
                {' · '}
                {new Date(item.recorded_at).toLocaleDateString()}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
