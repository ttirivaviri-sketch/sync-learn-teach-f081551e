/**
 * SubjectCard — compact list row per UI spec page 5 mockup:
 * small mastery ring on the left, subject name + ONE forward-looking status
 * line, chevron on the right. Never repeats "today" language (Home's job).
 */
import { ChevronRight } from 'lucide-react';
import { Subject } from '../types/study';
import { MasteryRing } from '@/components/ui/mastery-ring';
import { cn } from '@/lib/utils';

interface SubjectCardProps {
  subject: Subject;
  /** @deprecated Overview is forward-looking — daily task counts live on Home. */
  tasksCount?: number;
  onClick: () => void;
}

/** Forward-looking status — where the student *is*, not a to-do list. */
function statusLine(subject: Subject): string {
  const mastery = subject.currentTopic.mastery;
  const remaining = subject.topics.filter((t) => t.mastery < 95).length;
  if (mastery >= 95) return 'Topic mastered — ready to advance';
  if (mastery > 70) return 'On track — keep the momentum';
  if (mastery >= 30) return remaining > 0 ? `${remaining} topic${remaining === 1 ? '' : 's'} remaining to unlock next` : 'Building mastery';
  if (mastery > 0) return `${subject.currentTopic.name} · ${mastery}% mastered`;
  return 'Not started';
}

export function SubjectCard({ subject, onClick }: SubjectCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3.5 rounded-2xl bg-card border border-border px-4 py-3.5 text-left',
        'shadow-sm transition-all duration-200 hover:shadow-md hover:bg-muted/30 active:scale-[0.99]',
        'animate-fade-in'
      )}
    >
      <MasteryRing value={subject.overallMastery} size={44} strokeWidth={4} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-foreground truncate">{subject.name}</span>
        <span className="block text-xs text-muted-foreground truncate">{statusLine(subject)}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
    </button>
  );
}
