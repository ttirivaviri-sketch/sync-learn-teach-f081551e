import { Brain, AlertCircle, TrendingUp, Calendar, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { TopicReviewStatus } from '../hooks/useSpacedRepetition';

interface SpacedRepetitionWidgetProps {
  strugglingTopics: TopicReviewStatus[];
  topicsDueToday: TopicReviewStatus[];
  onStartReview?: (topic: TopicReviewStatus) => void;
}

export function SpacedRepetitionWidget({
  strugglingTopics,
  topicsDueToday,
  onStartReview,
}: SpacedRepetitionWidgetProps) {
  const hasReviewsDue = topicsDueToday.length > 0;
  const hasStrugglingTopics = strugglingTopics.length > 0;

  if (!hasReviewsDue && !hasStrugglingTopics) {
    return (
      <div className="p-4 rounded-2xl bg-success/10 border border-success/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/20">
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="font-medium text-success">All caught up!</p>
            <p className="text-xs text-muted-foreground">
              No reviews due. Keep studying to build your knowledge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reviews Due Today */}
      {hasReviewsDue && (
        <div className="p-4 rounded-2xl bg-accent/10 border border-accent/30">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-accent" />
            <h3 className="font-semibold text-foreground">Reviews Due Today</h3>
            <span className="ml-auto px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-bold">
              {topicsDueToday.length}
            </span>
          </div>
          <div className="space-y-2">
            {topicsDueToday.slice(0, 3).map((topic, index) => (
              <div
                key={`${topic.subject_id}-${topic.topic_name}-${index}`}
                className="flex items-center justify-between p-2 rounded-lg bg-background/50"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{topic.topic_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {topic.total_attempts} attempts • {topic.accuracy}% accuracy
                  </p>
                </div>
                {onStartReview && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onStartReview(topic)}
                    className="h-8 px-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {topicsDueToday.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                +{topicsDueToday.length - 3} more topics due
              </p>
            )}
          </div>
        </div>
      )}

      {/* Struggling Topics */}
      {hasStrugglingTopics && (
        <div className="p-4 rounded-2xl bg-warning/10 border border-warning/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-warning" />
            <h3 className="font-semibold text-foreground">Topics to Focus On</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            These topics need more practice (below 70% accuracy)
          </p>
          <div className="space-y-2">
            {strugglingTopics.slice(0, 3).map((topic, index) => (
              <div
                key={`${topic.subject_id}-${topic.topic_name}-${index}`}
                className="flex items-center justify-between p-2 rounded-lg bg-background/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-foreground">{topic.topic_name}</p>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            topic.accuracy >= 50 ? "bg-warning" : "bg-destructive"
                          )}
                          style={{ width: `${topic.accuracy}%` }}
                        />
                      </div>
                      <span className={cn(
                        "text-xs font-medium",
                        topic.accuracy >= 50 ? "text-warning" : "text-destructive"
                      )}>
                        {topic.accuracy}%
                      </span>
                    </div>
                  </div>
                </div>
                {onStartReview && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStartReview(topic)}
                    className="h-8 text-xs"
                  >
                    Practice
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart Review Button */}
      {(hasReviewsDue || hasStrugglingTopics) && onStartReview && (
        <Button
          onClick={() => {
            const priorityTopic = topicsDueToday[0] || strugglingTopics[0];
            if (priorityTopic) onStartReview(priorityTopic);
          }}
          className="w-full gradient-primary"
        >
          <Brain className="mr-2 h-4 w-4" />
          Start Smart Review Session
        </Button>
      )}
    </div>
  );
}
