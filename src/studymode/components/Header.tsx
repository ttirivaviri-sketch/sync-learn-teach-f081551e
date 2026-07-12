import { Calendar } from 'lucide-react';
import { useExamSettings } from '../hooks/useExamSettings';
import { useSubjectExams } from '../hooks/useSubjectExams';

/**
 * Lean Study Mode header — per the UI spec this is a compact utility bar
 * (~45px shorter than the old greeting/streak/XP hero it replaces).
 *
 * The greeting, streak and XP live on Home; the single app-wide
 * notification bell lives in the top app bar. This header only carries the
 * section title and, when known, the next exam countdown.
 */
export function Header() {
  const { getDaysUntilExam } = useExamSettings();
  const { getNextExam } = useSubjectExams();

  // Prefer subject-specific exam dates from calendar, fallback to global.
  const nextExam = getNextExam();
  const daysUntilExam = nextExam ? nextExam.daysRemaining : getDaysUntilExam();
  const showCountdown = daysUntilExam !== null && daysUntilExam >= 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-11 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary text-primary-foreground font-bold text-sm shadow-sm shrink-0">
            S
          </div>
          <h1 className="text-sm font-bold text-foreground truncate">Study Mode</h1>
        </div>

        {showCountdown && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs font-medium whitespace-nowrap">
              {daysUntilExam === 0 ? 'Exam today' : `${daysUntilExam} days to exams`}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
