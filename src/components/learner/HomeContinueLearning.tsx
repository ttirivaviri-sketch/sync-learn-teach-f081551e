/**
 * HomeContinueLearning — "CONTINUE LEARNING" section from UI spec page 3:
 * per-subject cards with a circular mastery ring (percentage centred) that
 * tap through to Study Mode. Hidden when the learner has no subjects yet.
 *
 * Each card carries a study intent so Study Mode opens the exact subject, and
 * resumes the last topic the learner worked on in that subject when known.
 */
import { MasteryRing } from "@/components/ui/mastery-ring";
import { useSubjects } from "@/studymode/hooks/useSubjects";
import { useLastSubjectActivity } from "@/hooks/useLastSubjectActivity";
import { setStudyIntent } from "@/studymode/lib/studyIntent";
import { haptic } from "@/lib/haptics";

interface HomeContinueLearningProps {
  onOpenStudy: () => void;
}

export function HomeContinueLearning({ onOpenStudy }: HomeContinueLearningProps) {
  const { data: subjects = [], isLoading } = useSubjects();
  const { data: lastActivity = {} } = useLastSubjectActivity();

  if (isLoading || subjects.length === 0) return null;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        Continue learning
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {subjects.slice(0, 4).map((s) => {
          const last = lastActivity[s.id];
          const resumeTopic = last?.topicName || undefined;
          return (
            <button
              key={s.id}
              onClick={() => {
                haptic("light");
                setStudyIntent({
                  subjectId: s.id,
                  subjectName: s.name,
                  topic: resumeTopic,
                  taskType: last?.source,
                });
                onOpenStudy();
              }}
              className="flex flex-col items-center gap-2 rounded-xl bg-card border border-border px-3 py-4 shadow-sm transition-colors hover:bg-muted/40 active:scale-[0.98]"
            >
              <MasteryRing value={s.overallMastery} size={56} strokeWidth={5} />
              <span className="text-sm font-medium text-foreground truncate max-w-full">
                {s.name}
              </span>
              {resumeTopic && (
                <span className="text-[11px] text-muted-foreground truncate max-w-full">
                  Resume · {resumeTopic}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
