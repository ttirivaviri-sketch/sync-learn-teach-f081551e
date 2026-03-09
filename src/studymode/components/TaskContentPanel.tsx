import { useEffect } from 'react';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from './ui/button';
import { DailyTask, Subject } from '../types/study';
import { useTaskContent } from '../hooks/useTaskContent';
import { cn } from '../lib/utils';

interface TaskContentPanelProps {
  task: DailyTask;
  subject: Subject;
  onComplete: () => void;
  onBack: () => void;
}

const taskLabels: Record<string, string> = {
  'micro-revision': 'Micro Revision',
  'concept-learning': 'Concept Learning',
  'active-recall': 'Active Recall',
};

export function TaskContentPanel({ task, subject, onComplete, onBack }: TaskContentPanelProps) {
  const { content, isLoading, error, generateContent, reset } = useTaskContent();

  useEffect(() => {
    reset();
    generateContent({
      taskType: task.type,
      subject: subject.name,
      topic: subject.currentTopic.name,
      subtopics: subject.currentTopic.subtopics,
    });
  }, [task.id]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h3 className="text-lg font-bold text-foreground">{task.title}</h3>
          <p className="text-sm text-muted-foreground">
            {taskLabels[task.type]} • {subject.currentTopic.name}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 rounded-2xl bg-card border border-border min-h-[200px]">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                generateContent({
                  taskType: task.type,
                  subject: subject.name,
                  topic: subject.currentTopic.name,
                  subtopics: subject.currentTopic.subtopics,
                })
              }
            >
              Retry
            </Button>
          </div>
        ) : content ? (
          <div className={cn(
            "prose prose-sm dark:prose-invert max-w-none",
            "[&_details]:mt-1 [&_details]:rounded-lg [&_details]:bg-muted/50 [&_details]:p-3",
            "[&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:text-accent",
            "[&_blockquote]:border-l-accent [&_blockquote]:bg-accent/5 [&_blockquote]:rounded-r-lg",
            isLoading && "animate-pulse"
          )}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">Generating your {taskLabels[task.type]?.toLowerCase()}...</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          onClick={onComplete}
          disabled={isLoading && !content}
          className="flex-1 gap-2 bg-success hover:bg-success/90 text-success-foreground"
        >
          <CheckCircle2 className="h-4 w-4" />
          Mark Complete
        </Button>
      </div>
    </div>
  );
}
