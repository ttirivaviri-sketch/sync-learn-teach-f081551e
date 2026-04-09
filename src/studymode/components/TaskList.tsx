import { Check, Lock, BookOpen, Brain, FileQuestion, RotateCcw, ChevronRight, Layers, FileText, ClipboardList } from 'lucide-react';
import { DailyTask } from '../types/study';
import { cn } from '@/lib/utils';

interface TaskListProps {
  tasks: DailyTask[];
  onTaskClick: (task: DailyTask) => void;
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

export function TaskList({ tasks, onTaskClick }: TaskListProps) {
  return (
    <div className="space-y-3">
      {tasks.map((task, index) => {
        const Icon = taskIcons[task.type];
        const colorClass = taskColors[task.type];

        return (
          <div
            key={task.id}
            onClick={() => !task.isLocked && onTaskClick(task)}
            className={cn(
              "relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-200",
              task.isCompleted 
                ? "bg-success/10 border-success/30"
                : task.isLocked
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
                : task.isLocked
                ? "bg-muted text-muted-foreground"
                : `bg-gradient-to-br ${colorClass} text-white`
            )}>
              {task.isCompleted ? (
                <Check className="h-5 w-5" />
              ) : task.isLocked ? (
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
                  task.isCompleted ? "text-success" : task.isLocked ? "text-muted-foreground" : "text-accent"
                )} />
                <h4 className={cn(
                  "font-semibold",
                  task.isCompleted ? "text-success" : task.isLocked ? "text-muted-foreground" : "text-foreground"
                )}>
                  {task.title}
                </h4>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {task.description}
              </p>
            </div>

            {/* Arrow */}
            {!task.isLocked && !task.isCompleted && (
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            )}

            {/* Completed Badge */}
            {task.isCompleted && (
              <span className="text-xs font-medium text-success bg-success/20 px-2 py-0.5 rounded-full">
                Done
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
