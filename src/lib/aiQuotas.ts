/**
 * aiQuotas — client-side mirror of the daily AI quota buckets enforced in
 * `supabase/functions/_shared/ai-config.ts`.
 *
 * Keep the numbers in sync with QUOTA_BUCKETS there. The edge functions remain
 * the source of truth; these values only drive the read-only usage dashboard.
 */

export const AI_QUOTA_BUCKETS = {
  quiz: 25,
  flashcards: 30,
  explain: 40,
  tutor: 30,
  daily_task: 3,
  mock_paper: 1,
  insights: 5,
  topic_session: 8,
  concept_review: 10,
  misc: 50,
} as const;

export type AiQuotaBucket = keyof typeof AI_QUOTA_BUCKETS;

/** Premium plans get 3x the standard daily allowance. */
export const AI_PREMIUM_MULTIPLIER = 3;

export const AI_BUCKET_LABELS: Record<string, string> = {
  quiz: "Quizzes & exam questions",
  flashcards: "Flashcards",
  explain: "Answer explanations",
  tutor: "AI tutor chat",
  daily_task: "Daily tasks",
  mock_paper: "Mock papers",
  insights: "Progress insights",
  topic_session: "Topic sessions",
  concept_review: "Concept reviews",
  misc: "Photo solve & other",
};

export function aiBucketLabel(bucket: string): string {
  return AI_BUCKET_LABELS[bucket] ?? bucket.replace(/_/g, " ");
}

/** Daily limit for a bucket, adjusted for the caller's plan. */
export function aiBucketLimit(bucket: string, isPremium: boolean): number {
  const base = AI_QUOTA_BUCKETS[bucket as AiQuotaBucket] ?? 0;
  return isPremium ? base * AI_PREMIUM_MULTIPLIER : base;
}

export const AI_BUCKET_ORDER: AiQuotaBucket[] = [
  "tutor",
  "quiz",
  "flashcards",
  "explain",
  "topic_session",
  "concept_review",
  "daily_task",
  "mock_paper",
  "insights",
  "misc",
];
