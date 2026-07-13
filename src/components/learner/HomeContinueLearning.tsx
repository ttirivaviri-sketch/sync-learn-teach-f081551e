/**
 * HomeContinueLearning — "CONTINUE LEARNING" section from UI spec page 3:
 * per-subject cards with a circular mastery ring (percentage centred) that
 * tap through to Study Mode. Hidden when the learner has no subjects yet.
 */
import { MasteryRing } from "@/components/ui/mastery-ring";
import { useSubjects } from "@/studymode/hooks/useSubjects";
import { haptic } from "@/lib/haptics";

interface HomeContinueLearningProps {
  onOpenStudy: () => void;
}

export function HomeContinueLearning({ onOpenStudy }: HomeContinueLearningProps) {
  const { data: subjects = [], isLoading } = useSubjects();

  if (isLoading || subjects.length === 0) return null;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        Continue learning
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {subjects.slice(0, 4).map((s) => (
          <button
            key={s.id}
            onClick={() => { haptic("light"); onOpenStudy(); }}
            className="flex flex-col items-center gap-2 rounded-xl bg-card border border-border px-3 py-4 shadow-sm transition-colors hover:bg-muted/40 active:scale-[0.98]"
          >
            <MasteryRing value={s.overallMastery} size={56} strokeWidth={5} />
            <span className="text-sm font-medium text-foreground truncate max-w-full">
              {s.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
