import { Flame, Zap, Trophy, Calendar, Sun, Moon } from 'lucide-react';
import { useUserProgress } from '../hooks/useUserProgress';
import { useExamSettings } from '../hooks/useExamSettings';
import { useSubjectExams } from '../hooks/useSubjectExams';
import { useAIGreeting } from '../hooks/useAIGreeting';
import { NotificationBell } from './NotificationBell';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';
import { useTheme } from 'next-themes';

export function Header() {
  const { progress } = useUserProgress();
  const { getDaysUntilExam } = useExamSettings();
  const { getNextExam } = useSubjectExams();
  const { greeting, isLoading: greetingLoading } = useAIGreeting();
  const { theme, setTheme } = useTheme();
  
  // Prefer subject-specific exam dates from calendar, fallback to global
  const nextExam = getNextExam();
  const daysUntilExam = nextExam ? nextExam.daysRemaining : getDaysUntilExam();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-primary-foreground font-bold text-lg shadow-md">
            S
          </div>
          <div className="max-w-[220px] sm:max-w-sm">
            {greetingLoading ? (
              <>
                <Skeleton className="h-5 w-40 mb-1" />
                <Skeleton className="h-3 w-24 hidden sm:block" />
              </>
            ) : (
              <>
                <h1 className="text-sm sm:text-lg font-bold text-foreground leading-tight line-clamp-2">
                  {greeting}
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Let's make today count</p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {daysUntilExam !== null && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">{daysUntilExam} days to exams</span>
            </div>
          )}

          <NotificationBell />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-9 w-9 rounded-full"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20">
            <Flame className="h-4 w-4 text-warning" />
            <span className="text-sm font-bold text-warning">{progress?.streak || 0}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
            <Zap className="h-4 w-4 text-accent" />
            <span className="text-sm font-bold text-accent">{(progress?.xp || 0).toLocaleString()}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20">
            <Trophy className="h-4 w-4 text-gold" />
            <span className="text-sm font-bold text-gold">{progress?.badges?.length || 0}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
