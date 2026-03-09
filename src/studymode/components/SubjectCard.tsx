import { Lock, ChevronRight, Target } from 'lucide-react';
import { Subject } from '../types/study';
import { Progress } from './ui/progress';
import { cn } from '../lib/utils';

interface SubjectCardProps {
  subject: Subject;
  tasksCount: number;
  onClick: () => void;
}

export function SubjectCard({ subject, tasksCount, onClick }: SubjectCardProps) {
  const getMasteryColor = (mastery: number) => {
    if (mastery >= 95) return 'text-success';
    if (mastery >= 70) return 'text-accent';
    if (mastery >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getProgressColor = (mastery: number) => {
    if (mastery >= 95) return 'bg-success';
    if (mastery >= 70) return 'bg-accent';
    if (mastery >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

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
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl text-2xl",
            `bg-gradient-to-br ${subject.color} shadow-md`
          )}>
            {subject.icon}
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground group-hover:text-accent transition-colors">
              {subject.name}
            </h3>
            <p className="text-sm text-muted-foreground">{tasksCount} tasks today</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" />
      </div>

      {/* Current Topic */}
      <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <Target className="h-4 w-4 text-accent" />
          <span className="text-xs font-medium text-muted-foreground">Current Topic</span>
        </div>
        <p className="text-sm font-medium text-foreground truncate">
          {subject.currentTopic.name}
        </p>
      </div>

      {/* Mastery Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Topic Mastery</span>
          <span className={cn("text-sm font-bold", getMasteryColor(subject.currentTopic.mastery))}>
            {subject.currentTopic.mastery}%
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div 
            className={cn("h-full rounded-full transition-all duration-500", getProgressColor(subject.currentTopic.mastery))}
            style={{ width: `${subject.currentTopic.mastery}%` }}
          />
        </div>
        {subject.currentTopic.mastery >= 95 && (
          <div className="flex items-center gap-1 text-xs text-success">
            <Lock className="h-3 w-3" />
            <span>Ready to advance!</span>
          </div>
        )}
      </div>

      {/* Locked Indicator */}
      {subject.currentTopic.isLocked && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Lock className="h-8 w-8" />
            <span className="text-sm font-medium">Topic Locked</span>
          </div>
        </div>
      )}
    </div>
  );
}
