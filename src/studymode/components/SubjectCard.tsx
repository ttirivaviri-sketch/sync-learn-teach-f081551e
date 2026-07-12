import { Lock, ChevronRight, Target } from 'lucide-react';
import { Subject } from '../types/study';
import { MasteryRing } from '@/components/ui/mastery-ring';
import { cn } from '@/lib/utils';

interface SubjectCardProps {
  subject: Subject;
  /** @deprecated Overview is forward-looking — daily task counts live on Home. */
  tasksCount?: number;
  onClick: () => void;
}

/**
 * Forward-looking status line per the UI spec — the Study Overview never
 * repeats "today" language (that belongs to Home). It says where the
 * student *is* in the subject instead.
 */
function statusLine(mastery: number): string {
  if (mastery >= 95) return 'Topic mastered — ready to advance';
  if (mastery > 70) return 'On track — keep the momentum';
  if (mastery >= 30) return 'Building mastery';
  return 'Just getting started';
}

export function SubjectCard({ subject, onClick }: SubjectCardProps) {
  const mastery = subject.currentTopic.mastery;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-card border border-border p-5 cursor-pointer",
        "transition-all duration-300 hover:shadow-lg hover:border-accent/50 hover:-translate-y-1",
        "animate-fade-in"
      )}
    >
      {/* Subject Icon & Name */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl text-2xl shrink-0",
            `bg-gradient-to-br ${subject.color} shadow-md`
          )}>
            {subject.icon}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-foreground group-hover:text-accent-foreground transition-colors truncate">
              {subject.name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">{statusLine(mastery)}</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent-foreground transition-colors shrink-0" />
      </div>

      {/* Current Topic + Mastery ring */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 p-3 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-accent-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Current Topic</span>
          </div>
          <p className="text-sm font-medium text-foreground truncate">
            {subject.currentTopic.name}
          </p>
          {mastery >= 95 && (
            <div className="flex items-center gap-1 text-xs text-success mt-1">
              <Lock className="h-3 w-3" />
              <span>Ready to advance!</span>
            </div>
          )}
        </div>
        <MasteryRing value={mastery} size={60} label="mastery" />
      </div>
    </div>
  );
}
