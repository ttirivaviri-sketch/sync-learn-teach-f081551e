import { GraduationCap, AlertTriangle, Lightbulb, Target, BookOpen, Activity } from 'lucide-react';
import { useLearningTimeline, type LearningEventRow } from '@/hooks/useLearningTimeline';
import type { LearningEventSource } from '@/lib/learningEvents';

interface StudentStruggle {
  topic: string;
  struggle: string;
  misconception: string;
  suggestedApproach: string;
}

interface TutorBriefingProps {
  struggles: StudentStruggle[];
  tutoringRecommended: boolean;
  tutoringReason: string | null;
  studentName?: string;
  /** Learner whose recent learning events should appear in the briefing. */
  learnerId?: string | null;
  /** Optional school context to scope events when relevant. */
  schoolId?: string | null;
  /** How many recent events to surface (default 5). */
  recentLimit?: number;
}

const SOURCE_LABEL: Record<LearningEventSource, string> = {
  topic_session: 'Study session',
  school_homework: 'Homework',
  lesson_reinforcement: 'Lesson recap',
  school_quiz: 'School quiz',
  daily_task: 'Daily task',
  mock_exam: 'Mock exam',
  booking_completed: 'Tutoring session',
};

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function eventTitle(ev: LearningEventRow): string {
  return ev.topic_name?.trim() || SOURCE_LABEL[ev.source] || 'Activity';
}

export function TutorBriefing({
  struggles,
  tutoringRecommended,
  tutoringReason,
  studentName = 'Student',
  learnerId = null,
  schoolId = null,
  recentLimit = 5,
}: TutorBriefingProps) {
  const { data: recentEvents = [], isLoading: eventsLoading } = useLearningTimeline({
    userId: learnerId,
    schoolId,
    limit: recentLimit,
    enabled: !!learnerId,
  });

  const hasRecent = recentEvents.length > 0;

  if (!tutoringRecommended && struggles.length === 0 && !hasRecent && !eventsLoading) return null;

  return (
    <div className="space-y-4">
      {/* Tutoring Recommendation Banner */}
      {tutoringRecommended && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/30">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-primary/20">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground flex items-center gap-2">
                Tutoring Recommended
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                  AI SUGGESTION
                </span>
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {tutoringReason || 'Based on recent performance patterns, a tutoring session could help accelerate progress.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Learning Activity (unified timeline) */}
      {learnerId && (hasRecent || eventsLoading) && (
        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground">Recent Learning Activity</h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">
              LAST {recentLimit}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            What {studentName} has been working on most recently — use this to anchor the next session.
          </p>

          {eventsLoading && !hasRecent ? (
            <div className="text-xs text-muted-foreground">Loading recent activity…</div>
          ) : (
            <ul className="space-y-2">
              {recentEvents.map((ev) => {
                const score = typeof ev.score_pct === 'number' ? Math.round(ev.score_pct) : null;
                const scoreTone =
                  score === null
                    ? 'bg-muted text-muted-foreground'
                    : score >= 75
                    ? 'bg-green-500/15 text-green-600'
                    : score >= 50
                    ? 'bg-yellow-500/15 text-yellow-700'
                    : 'bg-destructive/15 text-destructive';
                return (
                  <li
                    key={ev.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-muted/40 border border-border"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{eventTitle(ev)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {SOURCE_LABEL[ev.source] || ev.source} · {formatRelative(ev.occurred_at)}
                      </p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${scoreTone}`}>
                      {score === null ? '—' : `${score}%`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Student Struggles - Tutor Preparation Guide */}
      {struggles.length > 0 && (
        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-accent" />
            <h3 className="font-bold text-foreground">Tutor Preparation Brief</h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent">
              FOR TUTORS
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            AI-identified areas where {studentName} needs guided support. Use this to prepare for your next lesson.
          </p>

          <div className="space-y-3">
            {struggles.map((s, i) => (
              <div key={`${s.topic}-${i}`} className="p-3 rounded-xl bg-muted/50 border border-border space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  <h4 className="text-sm font-semibold text-foreground">{s.topic}</h4>
                </div>

                <div className="pl-6 space-y-1.5">
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-warning mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Struggling with:</span> {s.struggle}
                    </p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Likely misconception:</span> {s.misconception}
                    </p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Lightbulb className="h-3 w-3 text-accent mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Suggested approach:</span> {s.suggestedApproach}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
