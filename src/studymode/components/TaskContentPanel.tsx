import { useEffect } from 'react';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, BookOpen, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from './ui/button';
import { DailyTask, Subject } from '../types/study';
import { useTaskContent } from '../hooks/useTaskContent';
import { useSyllabusContext } from '../hooks/useSyllabusContext';
import { useTopicPerformance } from '../hooks/useTopicPerformance';
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
  'exam-question': 'Exam Question',
  'flashcards': 'Flashcards',
  'summary': 'Topic Summary',
  'revision-checklist': 'Revision Checklist',
};

const taskIcons: Record<string, string> = {
  'micro-revision': '⚡',
  'concept-learning': '📘',
  'active-recall': '🧠',
  'exam-question': '📝',
  'flashcards': '🃏',
  'summary': '📋',
  'revision-checklist': '✅',
};

export function TaskContentPanel({ task, subject, onComplete, onBack }: TaskContentPanelProps) {
  const { content, isLoading, error, generateContent, reset } = useTaskContent();

  // ── Fetch full curriculum context ──────────────────────────────────────────
  const {
    curriculumContext,
    examWeightFromPapers,
    examPatterns,
    pastPaperQuestions,
    isLoaded: contextLoaded,
  } = useSyllabusContext(subject.id, subject.currentTopic.name);

  // ── Fetch topic performance for adaptive content ───────────────────────────
  const { performance } = useTopicPerformance(subject.id, subject.currentTopic.name);

  // ── Generate content once context is loaded ───────────────────────────────
  useEffect(() => {
    if (!contextLoaded) return; // Wait for curriculum context to load

    reset();

    // Build performance context for adaptive content depth
    let performanceContext = '';
    if (performance && performance.totalAttempts > 0) {
      performanceContext = `Student accuracy on this topic: ${Math.round(performance.accuracy * 100)}%. `;
      if (performance.masteryStatus === 'mastered') {
        performanceContext += 'Student has mastered this topic — focus on exam application and edge cases.';
      } else if (performance.weakConcepts.length > 0) {
        performanceContext += `Student struggles with: ${performance.weakConcepts.join(', ')}. Prioritise these areas.`;
      }
    }

    generateContent({
      taskType: task.type,
      subject: subject.name,
      subjectId: subject.id,
      topic: subject.currentTopic.name,
      subtopics: subject.currentTopic.subtopics,
      examWeight: examWeightFromPapers || subject.currentTopic.examWeight,
      curriculumContext: curriculumContext || undefined,
      performanceContext: performanceContext || undefined,
      masteryStatus: performance?.masteryStatus,
      difficulty: performance?.recommendedDifficulty,
    });
  }, [task.id, contextLoaded]);

  const hasCurriculumData = !!curriculumContext;
  const hasPastPapers = pastPaperQuestions.length > 0;
  const hasExamPatterns = examPatterns.length > 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-foreground truncate">
            {taskIcons[task.type] || '📖'} {task.title}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {taskLabels[task.type]} · {subject.currentTopic.name}
          </p>
        </div>
      </div>

      {/* Curriculum context badges */}
      {(hasCurriculumData || hasPastPapers || hasExamPatterns) && (
        <div className="flex flex-wrap gap-2 px-1">
          {hasCurriculumData && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
              <BookOpen className="h-3 w-3" />
              Using your syllabus
            </span>
          )}
          {hasPastPapers && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
              <Zap className="h-3 w-3" />
              {pastPaperQuestions.length} past paper question{pastPaperQuestions.length !== 1 ? 's' : ''} analysed
            </span>
          )}
          {hasExamPatterns && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
              📊 Exam patterns loaded
            </span>
          )}
          {performance?.masteryStatus === 'mastered' && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
              ✅ Topic mastered — advanced content
            </span>
          )}
        </div>
      )}

      {/* Loading — waiting for context */}
      {!contextLoaded && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading your curriculum data...</p>
        </div>
      )}

      {/* Content */}
      {contextLoaded && (
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
                    subjectId: subject.id,
                    topic: subject.currentTopic.name,
                    subtopics: subject.currentTopic.subtopics,
                    examWeight: examWeightFromPapers || subject.currentTopic.examWeight,
                    curriculumContext: curriculumContext || undefined,
                  })
                }
              >
                Retry
              </Button>
            </div>
          ) : content ? (
            <div
              className={cn(
                'prose prose-sm dark:prose-invert max-w-none',
                '[&_details]:mt-1 [&_details]:rounded-lg [&_details]:bg-muted/50 [&_details]:p-3',
                '[&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:text-accent',
                '[&_blockquote]:border-l-accent [&_blockquote]:bg-accent/5 [&_blockquote]:rounded-r-lg',
                isLoading && 'animate-pulse',
              )}
            >
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">
                Generating your {taskLabels[task.type]?.toLowerCase() || 'content'}...
              </p>
              {hasCurriculumData && (
                <p className="text-xs text-muted-foreground">
                  Tailoring to your {subject.name} syllabus
                </p>
              )}
            </div>
          )}
        </div>
      )}

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
