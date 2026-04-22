import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, BookOpen, Zap, Send, Eye, MinusCircle, Brain } from 'lucide-react';
import { MathMarkdown } from './MathMarkdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DailyTask, Subject } from '../types/study';
import { useTaskContent } from '../hooks/useTaskContent';
import { useSyllabusContext } from '../hooks/useSyllabusContext';
import { useTopicPerformance } from '../hooks/useTopicPerformance';
import { useUserProgress } from '../hooks/useUserProgress';
import { supabase } from '../../integrations/supabase/client';
import { cn } from '@/lib/utils';
import { StructuredDailyTaskRunner } from './StructuredDailyTaskRunner';

interface TaskContentPanelProps {
  task: DailyTask;
  subject: Subject;
  onComplete: () => void;
  onBack: () => void;
}

// Task types that should use the new syllabus-grounded structured runner
const STRUCTURED_TASK_TYPES: DailyTask['type'][] = ['concept-learning'];

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

// Active recall tasks need an attempt-first answering panel
const ATTEMPT_FIRST_TYPES = ['active-recall'];

export function TaskContentPanel(props: TaskContentPanelProps) {
  // Syllabus-grounded structured runner for applicable task types
  if (STRUCTURED_TASK_TYPES.includes(props.task.type)) {
    return <StructuredDailyTaskRunner {...props} />;
  }
  return <LegacyTaskContentPanel {...props} />;
}

function LegacyTaskContentPanel({ task, subject, onComplete, onBack }: TaskContentPanelProps) {
  const { content, isLoading, error, generateContent, reset } = useTaskContent();
  const { addXp, updateStreak } = useUserProgress();

  // Answer-first state for active-recall
  const [userAnswer, setUserAnswer] = useState('');
  const [hasAttempted, setHasAttempted] = useState(false);
  const [revealedEarly, setRevealedEarly] = useState(false);
  const [xpChange, setXpChange] = useState(0);
  const isAttemptFirst = ATTEMPT_FIRST_TYPES.includes(task.type);

  const {
    curriculumContext,
    examWeightFromPapers,
    examPatterns,
    pastPaperQuestions,
    isLoaded: contextLoaded,
  } = useSyllabusContext(subject.id, subject.currentTopic.name);

  const { performance } = useTopicPerformance(subject.id, subject.currentTopic.name);

  useEffect(() => {
    if (!contextLoaded) return;

    reset();
    setUserAnswer('');
    setHasAttempted(false);
    setRevealedEarly(false);
    setXpChange(0);

    const loadAndGenerate = async () => {
      let performanceContext = '';
      if (performance && performance.totalAttempts > 0) {
        performanceContext = `Student accuracy on this topic: ${Math.round(performance.accuracy * 100)}%. `;
        if (performance.masteryStatus === 'mastered') {
          performanceContext += 'Student has mastered this topic — focus on exam application and edge cases.';
        } else if (performance.weakConcepts.length > 0) {
          performanceContext += `Student struggles with: ${performance.weakConcepts.join(', ')}. Prioritise these areas.`;
        }
      }

      // Query recently studied subtopics for concept-learning diversification
      let previouslyStudiedSubtopics: string[] = [];
      if (task.type === 'concept-learning') {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: recentActivity } = await supabase
              .from('study_activity')
              .select('metadata')
              .eq('user_id', user.id)
              .eq('subject', subject.name)
              .eq('topic', subject.currentTopic.name)
              .eq('activity_type', 'concept-learning')
              .order('created_at', { ascending: false })
              .limit(20);

            if (recentActivity) {
              previouslyStudiedSubtopics = recentActivity
                .map(a => (a.metadata as any)?.subtopicFocus)
                .filter(Boolean);
            }
          }
        } catch {
          // silent
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
        previouslyStudiedSubtopics: previouslyStudiedSubtopics.length > 0 ? previouslyStudiedSubtopics : undefined,
      });
    };

    loadAndGenerate();
  }, [task.id, contextLoaded]);

  const hasCurriculumData = !!curriculumContext;
  const hasPastPapers = pastPaperQuestions.length > 0;
  const hasExamPatterns = examPatterns.length > 0;

  const handleSubmitAnswer = () => {
    setHasAttempted(true);
    setRevealedEarly(false);
    // Award XP for attempting
    addXp.mutate(15);
    updateStreak.mutate();
    setXpChange(15);
  };

  const handleRevealEarly = () => {
    setHasAttempted(true);
    setRevealedEarly(true);
    // Negative XP for revealing without attempting
    addXp.mutate(-5);
    setXpChange(-5);
  };

  // For attempt-first types, content is hidden until attempted
  const shouldShowContent = !isAttemptFirst || hasAttempted;

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
        {xpChange !== 0 && (
          <span className={cn(
            "text-xs font-bold px-2 py-1 rounded-full",
            xpChange > 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
          )}>
            {xpChange > 0 ? '+' : ''}{xpChange} XP
          </span>
        )}
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
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            <Brain className="h-3 w-3" />
            AI-enriched with internet
          </span>
        </div>
      )}

      {/* Loading — waiting for context */}
      {!contextLoaded && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading your curriculum data...</p>
        </div>
      )}

      {/* Active Recall: Answer panel BEFORE revealing content */}
      {contextLoaded && isAttemptFirst && !hasAttempted && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-warning/10 border border-warning/30">
            <h4 className="font-semibold text-foreground mb-1 flex items-center gap-2">
              🧠 Active Recall Challenge
            </h4>
            <p className="text-sm text-muted-foreground">
              Write down everything you remember about <span className="font-medium text-foreground">{subject.currentTopic.name}</span> before seeing the notes. This strengthens memory retention.
            </p>
          </div>

          <Textarea
            placeholder={`What do you remember about ${subject.currentTopic.name}? Write key concepts, formulas, definitions...`}
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            className="min-h-[150px] text-sm"
          />

          <div className="flex gap-2">
            <Button
              onClick={handleSubmitAnswer}
              disabled={!userAnswer.trim()}
              className="flex-1 gradient-primary"
            >
              <Send className="mr-2 h-4 w-4" />
              Submit & Reveal Notes (+15 XP)
            </Button>
            <Button
              variant="outline"
              onClick={handleRevealEarly}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <MinusCircle className="mr-1 h-4 w-4" />
              Reveal (−5 XP)
            </Button>
          </div>
        </div>
      )}

      {/* Show student's recall attempt */}
      {contextLoaded && isAttemptFirst && hasAttempted && userAnswer.trim() && (
        <div className="p-4 rounded-xl border border-border bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            {revealedEarly ? '⚠️ Skipped — Your recall was not submitted' : '✅ Your Recall Attempt'}
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{userAnswer}</p>
        </div>
      )}

      {/* Content (hidden for active-recall until attempted) */}
      {contextLoaded && shouldShowContent && (
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
              <MathMarkdown>{content}</MathMarkdown>
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
