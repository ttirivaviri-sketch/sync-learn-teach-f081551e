import { Check, Lock, BookOpen, Brain, FileQuestion, RotateCcw, ChevronRight, Layers, FileText, ClipboardList, Clock } from 'lucide-react';
import { DailyTask } from '../types/study';
import { cn } from '@/lib/utils';

interface TaskListProps {
  tasks: DailyTask[];
  onTaskClick: (task: DailyTask) => void;
  onAddBonusTask?: () => void;
}

const taskIcons: Record<string, typeof BookOpen> = {
  'micro-revision': RotateCcw,
  'concept-learning': BookOpen,
  'active-recall': Brain,
  'exam-question': FileQuestion,
  'flashcards': Layers,
  'summary': FileText,
  'revision-checklist': ClipboardList,
};

const taskColors: Record<string, string> = {
  'micro-revision': 'from-blue-500 to-blue-600',
  'concept-learning': 'from-violet-500 to-purple-600',
  'active-recall': 'from-amber-500 to-orange-500',
  'exam-question': 'from-rose-500 to-red-600',
  'flashcards': 'from-teal-500 to-emerald-600',
  'summary': 'from-indigo-500 to-blue-600',
  'revision-checklist': 'from-pink-500 to-rose-600',
};

const taskDurations: Record<string, string> = {
  'micro-revision': '3 min',
  'concept-learning': '8 min',
  'active-recall': '10 min',
  'exam-question': '15 min',
  'flashcards': '5 min',
  'summary': '6 min',
  'revision-checklist': '4 min',
};

export function TaskList({ tasks, onTaskClick, onAddBonusTask }: TaskListProps) {
  const allCompleted = tasks.length > 0 && tasks.every(t => t.isCompleted);

  return (
    <div className="space-y-3">
      {tasks.map((task, index) => {
        const Icon = taskIcons[task.type];
        const colorClass = taskColors[task.type];
        const duration = taskDurations[task.type];
        // When all daily tasks are complete, force-unlock any remaining locked tiles
        const effectiveLocked = task.isLocked && !allCompleted;
        const clickable = !effectiveLocked; // completed tasks are replayable

        return (
          <div
            key={task.id}
            onClick={() => clickable && onTaskClick(task)}
            className={cn(
              "relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-200",
              task.isCompleted 
                ? "bg-success/10 border-success/30 hover:border-success/50 hover:shadow-md cursor-pointer"
                : effectiveLocked
                ? "bg-muted/50 border-border cursor-not-allowed opacity-60"
                : "bg-card border-border hover:border-accent/50 hover:shadow-md cursor-pointer"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Step Number / Status */}
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shrink-0",
              task.isCompleted 
                ? "bg-success text-success-foreground"
                : effectiveLocked
                ? "bg-muted text-muted-foreground"
                : `bg-gradient-to-br ${colorClass} text-white`
            )}>
              {task.isCompleted ? (
                <Check className="h-5 w-5" />
              ) : effectiveLocked ? (
                <Lock className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </div>

            {/* Task Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Icon className={cn(
                  "h-4 w-4",
                  task.isCompleted ? "text-success" : effectiveLocked ? "text-muted-foreground" : "text-accent"
                )} />
                <h4 className={cn(
                  "font-semibold",
                  task.isCompleted ? "text-success" : effectiveLocked ? "text-muted-foreground" : "text-foreground"
                )}>
                  {task.title}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground truncate flex-1">
                  {task.description}
                </p>
                {duration && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0 bg-muted/50 px-1.5 py-0.5 rounded-full">
                    <Clock className="h-2.5 w-2.5" />
                    {duration}
                  </span>
                )}
              </div>
            </div>

            {/* Arrow */}
            {!effectiveLocked && !task.isCompleted && (
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            )}

            {/* Completed Badge — tappable replay hint */}
            {task.isCompleted && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-medium text-success bg-success/20 px-2 py-0.5 rounded-full">
                  Done
                </span>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">Replay</span>
                <ChevronRight className="h-4 w-4 text-success/70" />
              </div>
            )}
          </div>
        );
      })}

      {/* Practice More button when all tasks completed */}
      {allCompleted && onAddBonusTask && (
        <button
          onClick={onAddBonusTask}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-accent/30 bg-accent/5 hover:bg-accent/10 hover:border-accent/50 transition-all duration-200 text-accent font-semibold"
        >
          <RotateCcw className="h-4 w-4" />
          Practice More — Add Another Task
        </button>
      )}
    </div>
  );
}