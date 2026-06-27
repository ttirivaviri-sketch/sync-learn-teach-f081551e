import { BrainCircuit, ShieldAlert, TrendingUp } from 'lucide-react';
import { useMasteryIntelligence } from '../hooks/useMasteryIntelligence';

interface MasteryIntelligenceCardProps {
  subjectId: string;
  subjectName: string;
}

export function MasteryIntelligenceCard({ subjectId, subjectName }: MasteryIntelligenceCardProps) {
  const { strongest, weakest, rollups, isLoading } = useMasteryIntelligence({ subjectId, subjectName });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BrainCircuit className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-bold text-foreground">Mastery Intelligence</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Concept-level confidence built from recall, flashcards, mock exams, and daily task evidence.
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Computing concept confidence…</p>
      ) : rollups.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-success/20 bg-success/10 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-success" />
              Strongest concepts
            </div>
            <div className="space-y-2">
              {strongest.slice(0, 3).map((concept) => (
                <div key={`${concept.topicName}-${concept.conceptName}`}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground font-medium truncate">{concept.conceptName}</span>
                    <span className="text-success font-semibold">{concept.confidenceScore}%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {concept.topicName} · {concept.evidenceCount} evidence point{concept.evidenceCount === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-warning/20 bg-warning/10 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <ShieldAlert className="h-3.5 w-3.5 text-warning" />
              Concepts needing repair
            </div>
            <div className="space-y-2">
              {weakest.slice(0, 3).map((concept) => (
                <div key={`${concept.topicName}-${concept.conceptName}`}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground font-medium truncate">{concept.conceptName}</span>
                    <span className="text-warning font-semibold">{concept.confidenceScore}%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {concept.topicName} · latest {new Date(concept.lastRecordedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No mastery ledger evidence yet. Complete recall, flashcards, structured tasks, or exam questions to populate concept confidence.
        </p>
      )}
    </div>
  );
}
