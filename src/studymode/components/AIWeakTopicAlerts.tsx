import { useState, useCallback } from 'react';
import { AlertTriangle, Eye, ShieldAlert, Sparkles, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { TopicReviewStatus } from '../hooks/useSpacedRepetition';
import { TutorBriefing } from './TutorBriefing';
import { aiRequestJSON } from '../lib/aiClient';

interface WeakTopic {
  topic: string;
  severity: 'critical' | 'warning' | 'watch';
  reason: string;
  suggestion: string;
}

interface StudentStruggle {
  topic: string;
  struggle: string;
  misconception: string;
  suggestedApproach: string;
}

interface WeakTopicAnalysis {
  weakTopics: WeakTopic[];
  overallMessage: string;
  tutoringRecommended: boolean;
  tutoringReason: string | null;
  studentStruggles: StudentStruggle[];
}

interface AIWeakTopicAlertsProps {
  topicStats: TopicReviewStatus[];
  subjects: Array<{ name: string; currentTopic: string; mastery: number }>;
  onStartReview?: (topicName: string) => void;
}

const severityConfig = {
  critical: {
    icon: ShieldAlert,
    label: 'Critical',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    badgeBg: 'bg-destructive/20',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Needs Work',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    badgeBg: 'bg-warning/20',
  },
  watch: {
    icon: Eye,
    label: 'Watch',
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    borderColor: 'border-accent/30',
    badgeBg: 'bg-accent/20',
  },
};

export function AIWeakTopicAlerts({ topicStats, subjects, onStartReview }: AIWeakTopicAlertsProps) {
  const [analysis, setAnalysis] = useState<WeakTopicAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const analyze = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data: WeakTopicAnalysis = await aiRequestJSON('detect-weak-topics', {
            topicStats: topicStats.map(t => ({
              topic_name: t.topic_name,
              accuracy: t.accuracy,
              total_attempts: t.total_attempts,
              average_ease: t.average_ease,
              due_for_review: t.due_for_review,
            })),
            subjects,
          });
      setAnalysis(data);
      setHasAnalyzed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to analyze');
    } finally {
      setIsLoading(false);
    }
  }, [topicStats, subjects]);

  // Not yet analyzed
  if (!hasAnalyzed && !isLoading) {
    return (
      <div className="p-4 rounded-2xl bg-gradient-to-br from-accent/10 to-warning/10 border border-accent/20">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-foreground">AI Weak Topic Detection</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          AI analyzes your quiz patterns to flag topics needing extra attention.
        </p>
        <Button
          onClick={analyze}
          size="sm"
          className="gap-2 gradient-primary"
          disabled={topicStats.length === 0}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {topicStats.length === 0 ? 'Complete quizzes first' : 'Analyze My Topics'}
        </Button>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Analyzing your quiz performance...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={analyze}>Retry</Button>
      </div>
    );
  }

  if (!analysis) return null;

  const { weakTopics, overallMessage, tutoringRecommended, tutoringReason, studentStruggles } = analysis;

  return (
    <div className="space-y-3">
      {/* Overall Message */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <h3 className="font-semibold text-foreground">AI Topic Analysis</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={analyze} className="gap-1 text-muted-foreground h-7">
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
        <p className="text-sm text-foreground">{overallMessage}</p>
      </div>

      {/* Tutoring Recommendation & Student Struggles for Tutors */}
      <TutorBriefing
        struggles={studentStruggles || []}
        tutoringRecommended={tutoringRecommended || false}
        tutoringReason={tutoringReason || null}
      />

      {/* Weak Topics */}
      {weakTopics.length > 0 ? (
        <div className="space-y-2">
          {weakTopics.map((wt, i) => {
            const config = severityConfig[wt.severity];
            const Icon = config.icon;

            return (
              <div
                key={`${wt.topic}-${i}`}
                className={cn("p-3 rounded-xl border", config.bgColor, config.borderColor)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-foreground truncate">{wt.topic}</p>
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0", config.badgeBg, config.color)}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{wt.reason}</p>
                      <p className="text-xs text-foreground mt-1">💡 {wt.suggestion}</p>
                    </div>
                  </div>
                  {onStartReview && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 shrink-0"
                      onClick={() => onStartReview(wt.topic)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-success/10 border border-success/30 text-center">
          <p className="text-sm text-success font-medium">🎉 No weak topics detected!</p>
          <p className="text-xs text-muted-foreground mt-1">Keep up the great work.</p>
        </div>
      )}
    </div>
  );
}
