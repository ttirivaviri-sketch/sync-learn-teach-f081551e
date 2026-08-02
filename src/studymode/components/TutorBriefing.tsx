import { GraduationCap, AlertTriangle, Lightbulb, Target, BookOpen, Activity, Sparkles, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { useLearningTimeline, type LearningEventRow } from '@/hooks/useLearningTimeline';
import type { LearningEventSource } from '@/lib/learningEvents';

interface SuggestedAction {
  id: string;
  title: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Pure, deterministic (non-AI) suggestion builder from recent learning events.
 * Heuristics:
 *  - Any topic with avg score < 50% across recent events → high-priority review.
 *  - Topic scored 50–74% → medium-priority practice.
 *  - Topic appearing ≥2 times with avg ≥75% → low-priority "advance to next subtopic".
 *  - If the most recent event is a school_homework with score < 60% → high-priority re-teach.
 */
function buildSuggestions(events: LearningEventRow[]): SuggestedAction[] {
  if (!events.length) return [];
  const byTopic = new Map<string, { sum: number; n: number; sources: Set<string> }>();
  for (const ev of events) {
    const t = ev.topic_name?.trim();
    if (!t || typeof ev.score_pct !== 'number') continue;
    const cur = byTopic.get(t) ?? { sum: 0, n: 0, sources: new Set<string>() };
    cur.sum += ev.score_pct;
    cur.n += 1;
    cur.sources.add(ev.source);
    byTopic.set(t, cur);
  }

  const out: SuggestedAction[] = [];
  for (const [topic, { sum, n, sources }] of byTopic) {
    const avg = sum / n;
    if (avg < 50) {
      out.push({
        id: `review-${topic}`,
        title: `Re-teach “${topic}” from the basics`,
        reason: `Average ${Math.round(avg)}% across ${n} recent attempt${n > 1 ? 's' : ''} (${Array.from(sources).join(', ')}).`,
        priority: 'high',
      });
    } else if (avg < 75) {
      out.push({
        id: `practice-${topic}`,
        title: `Guided practice on “${topic}”`,
        reason: `Sitting at ${Math.round(avg)}% — work through 2–3 exam-style questions together.`,
        priority: 'medium',
      });
    } else if (n >= 2) {
      out.push({
        id: `advance-${topic}`,
        title: `Advance “${topic}” to a harder subtopic`,
        reason: `Consistently strong (${Math.round(avg)}% over ${n} attempts) — push toward exam-level questions.`,
        priority: 'low',
      });
    }
  }

  const latest = events[0];
  if (latest && latest.source === 'school_homework' && typeof latest.score_pct === 'number' && latest.score_pct < 60 && latest.topic_name) {
    const already = out.find((s) => s.id === `review-${latest.topic_name}`);
    if (!already) {
      out.unshift({
        id: `homework-${latest.id}`,
        title: `Walk through the latest homework on “${latest.topic_name}”`,
        reason: `Most recent homework scored ${Math.round(latest.score_pct)}%.`,
        priority: 'high',
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  return out.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 4);
}

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
  photo_solve: 'Photo solve',

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
    limit: Math.max(recentLimit, 20),
    enabled: !!learnerId,
  });

  const visibleEvents = useMemo(() => recentEvents.slice(0, recentLimit), [recentEvents, recentLimit]);
  const suggestions = useMemo(() => buildSuggestions(recentEvents), [recentEvents]);

  const hasRecent = visibleEvents.length > 0;
  const hasSuggestions = suggestions.length > 0;

  if (!tutoringRecommended && struggles.length === 0 && !hasRecent && !hasSuggestions && !eventsLoading) return null;

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
              {visibleEvents.map((ev) => {
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

      {/* Suggested Next Actions — derived locally from learning events, no AI call */}
      {learnerId && hasSuggestions && (
        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-accent-foreground" />
            <h3 className="font-bold text-foreground">Suggested Next Actions</h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent-foreground">
              FROM RECENT ACTIVITY
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Derived from {studentName}'s last {recentEvents.length} learning event{recentEvents.length === 1 ? '' : 's'} — no AI required.
          </p>
          <ul className="space-y-2">
            {suggestions.map((s) => {
              const tone =
                s.priority === 'high'
                  ? 'border-destructive/40 bg-destructive/5'
                  : s.priority === 'medium'
                  ? 'border-yellow-500/40 bg-yellow-500/5'
                  : 'border-green-500/40 bg-green-500/5';
              const badgeTone =
                s.priority === 'high'
                  ? 'bg-destructive/15 text-destructive'
                  : s.priority === 'medium'
                  ? 'bg-yellow-500/20 text-yellow-700'
                  : 'bg-green-500/15 text-green-600';
              return (
                <li key={s.id} className={`p-3 rounded-xl border ${tone}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <ArrowRight className="h-4 w-4 text-foreground/70 shrink-0" />
                      <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${badgeTone}`}>
                      {s.priority}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">{s.reason}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}



      {/* Student Struggles - Tutor Preparation Guide */}
      {struggles.length > 0 && (
        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-accent-foreground" />
            <h3 className="font-bold text-foreground">Tutor Preparation Brief</h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent-foreground">
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
                    <Lightbulb className="h-3 w-3 text-accent-foreground mt-0.5 shrink-0" />
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
