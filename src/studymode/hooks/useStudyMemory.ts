/**
 * useStudyMemory
 *
 * The long-term memory layer for the AI Study Engine.
 *
 * Responsibilities:
 *  - Log every study event (quiz answer, flashcard review, exam submit,
 *    concept breakdown view, task content generation) to the DB.
 *  - Read back topic summaries and daily digests so the AI knows:
 *      • What questions have already been asked (avoid repeating)
 *      • Which subtopics / concepts have been covered
 *      • Which concepts need reinforcement (low accuracy)
 *      • What was studied today vs this week
 *  - Expose buildMemoryContext() which produces the compact natural-language
 *    block injected into every AI prompt.
 *
 * The hook is lightweight — it never blocks the UI.
 * All DB writes are fire-and-forget (errors are logged, not thrown).
 */

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { logger } from '@/utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemoryEventType =
  | 'quiz_question'
  | 'flashcard_review'
  | 'exam_session'
  | 'concept_breakdown'
  | 'task_content'
  | 'recall_session'
  | 'weak_concept_flag';

export interface LogMemoryEventParams {
  eventType: MemoryEventType;
  subjectId?: string;
  subjectName: string;
  topicName: string;
  subtopicName?: string;
  curriculum?: string;
  /** The question text shown to the student (trimmed to 200 chars before storage) */
  questionText?: string;
  /** Concept keywords extracted from the AI response */
  conceptsTested?: string[];
  /** Command word used (e.g. "Calculate", "Explain", "Compare") */
  commandWord?: string;
  /** Whether the student answered correctly (quiz / flashcard) */
  wasCorrect?: boolean;
  /** Raw score (marks awarded) */
  scoreRaw?: number;
  /** Maximum possible score */
  scoreMax?: number;
  /** Difficulty level of the content */
  difficulty?: 'easy' | 'medium' | 'hard' | 'exam-level';
  /** SM-2 ease factor (flashcards only) */
  easeFactor?: number;
  /** Any extra structured data (exam paper id, flashcard id, etc.) */
  metadata?: Json;
}

export interface TopicMemorySummary {
  topicName: string;
  subjectName: string;
  subtopicsCovered: string[];
  conceptsCovered: string[];
  conceptsWeak: string[];
  conceptsMastered: string[];
  questionsSeen: string[];
  commandWordsUsed: string[];
  quizAttempts: number;
  quizCorrect: number;
  avgScorePct: number | null;
  bestScorePct: number | null;
  lastScorePct: number | null;
  needsReinforcement: boolean;
  topicComplete: boolean;
  lastActivityAt: string | null;
}

export interface DailyDigest {
  studyDate: string;
  topicsStudied: string[];
  subtopicsStudied: string[];
  quizCount: number;
  quizCorrect: number;
  flashcardCount: number;
  examCount: number;
  avgScorePct: number | null;
}

export interface StudyMemoryContext {
  /** All topic summaries for the subject (sorted by last activity desc) */
  topicSummaries: TopicMemorySummary[];
  /** Daily digests for the past 7 days */
  recentDays: DailyDigest[];
  /** Quick-access: set of question texts already seen (for prompt injection) */
  questionsSeenSet: Set<string>;
  /** Quick-access: all weak concepts across all topics */
  allWeakConcepts: string[];
  /** Quick-access: topics that need reinforcement */
  topicsNeedingReinforcement: string[];
  /** Whether ANY memory exists for this subject */
  hasMemory: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStudyMemory() {
  // Cache memory context per subject so we don't re-fetch on every render
  const memoryCache = useRef<Map<string, { data: StudyMemoryContext; fetchedAt: number }>>(
    new Map()
  );
  const CACHE_TTL_MS = 60_000; // 1 minute

  // ── Log a study event (fire-and-forget) ─────────────────────────────────

  const logEvent = useCallback(async (params: LogMemoryEventParams): Promise<void> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('study_memory_events').insert({
        user_id: user.id,
        event_type: params.eventType,
        subject_id: params.subjectId ?? null,
        subject_name: params.subjectName,
        topic_name: params.topicName,
        subtopic_name: params.subtopicName ?? null,
        curriculum: params.curriculum ?? null,
        question_text: params.questionText
          ? params.questionText.slice(0, 200)
          : null,
        concepts_tested: params.conceptsTested ?? null,
        command_word: params.commandWord ?? null,
        was_correct: params.wasCorrect ?? null,
        score_raw: params.scoreRaw ?? null,
        score_max: params.scoreMax ?? null,
        difficulty: params.difficulty ?? null,
        ease_factor: params.easeFactor ?? null,
        metadata: params.metadata ?? {},
      });

      if (error) {
        logger.warn('[StudyMemory] logEvent error:', error.message);
      } else {
        // Invalidate cache for this subject so next fetch picks up new data
        memoryCache.current.delete(params.subjectName);
      }
    } catch (err) {
      logger.warn('[StudyMemory] logEvent exception:', err);
    }
  }, []);

  // ── Fetch memory context for a subject ──────────────────────────────────

  const fetchMemoryContext = useCallback(
    async (subjectName: string): Promise<StudyMemoryContext> => {
      const empty: StudyMemoryContext = {
        topicSummaries: [],
        recentDays: [],
        questionsSeenSet: new Set(),
        allWeakConcepts: [],
        topicsNeedingReinforcement: [],
        hasMemory: false,
      };

      // Return from cache if fresh
      const cached = memoryCache.current.get(subjectName);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.data;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return empty;

        const [summaryRes, dailyRes] = await Promise.all([
          supabase
            .from('study_memory_summary')
            .select(
              `topic_name, subject_name,
               subtopics_covered, concepts_covered,
               concepts_weak, concepts_mastered,
               questions_seen, command_words_used,
               quiz_attempts, quiz_correct,
               avg_score_pct, best_score_pct, last_score_pct,
               needs_reinforcement, topic_complete, last_activity_at`
            )
            .eq('user_id', user.id)
            .eq('subject_name', subjectName)
            .order('last_activity_at', { ascending: false })
            .limit(30),

          supabase
            .from('study_memory_daily')
            .select(
              `study_date, topics_studied, subtopics_studied,
               quiz_count, quiz_correct, flashcard_count, exam_count,
               avg_score_pct`
            )
            .eq('user_id', user.id)
            .eq('subject_name', subjectName)
            .gte('study_date', new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10))
            .order('study_date', { ascending: false }),
        ]);

        const topicSummaries: TopicMemorySummary[] = (summaryRes.data ?? []).map((row: any) => ({
          topicName: row.topic_name,
          subjectName: row.subject_name,
          subtopicsCovered: row.subtopics_covered ?? [],
          conceptsCovered: row.concepts_covered ?? [],
          conceptsWeak: row.concepts_weak ?? [],
          conceptsMastered: row.concepts_mastered ?? [],
          questionsSeen: row.questions_seen ?? [],
          commandWordsUsed: row.command_words_used ?? [],
          quizAttempts: row.quiz_attempts ?? 0,
          quizCorrect: row.quiz_correct ?? 0,
          avgScorePct: row.avg_score_pct ?? null,
          bestScorePct: row.best_score_pct ?? null,
          lastScorePct: row.last_score_pct ?? null,
          needsReinforcement: row.needs_reinforcement ?? false,
          topicComplete: row.topic_complete ?? false,
          lastActivityAt: row.last_activity_at ?? null,
        }));

        const recentDays: DailyDigest[] = (dailyRes.data ?? []).map((row: any) => ({
          studyDate: row.study_date,
          topicsStudied: row.topics_studied ?? [],
          subtopicsStudied: row.subtopics_studied ?? [],
          quizCount: row.quiz_count ?? 0,
          quizCorrect: row.quiz_correct ?? 0,
          flashcardCount: row.flashcard_count ?? 0,
          examCount: row.exam_count ?? 0,
          avgScorePct: row.avg_score_pct ?? null,
        }));

        const questionsSeenSet = new Set<string>(
          topicSummaries.flatMap((t) => t.questionsSeen)
        );
        const allWeakConcepts = [
          ...new Set(topicSummaries.flatMap((t) => t.conceptsWeak)),
        ];
        const topicsNeedingReinforcement = topicSummaries
          .filter((t) => t.needsReinforcement)
          .map((t) => t.topicName);

        const ctx: StudyMemoryContext = {
          topicSummaries,
          recentDays,
          questionsSeenSet,
          allWeakConcepts,
          topicsNeedingReinforcement,
          hasMemory: topicSummaries.length > 0 || recentDays.length > 0,
        };

        memoryCache.current.set(subjectName, { data: ctx, fetchedAt: Date.now() });
        return ctx;
      } catch (err) {
        logger.warn('[StudyMemory] fetchMemoryContext error:', err);
        return empty;
      }
    },
    []
  );

  // ── Build the natural-language memory context string for AI prompts ──────
  // This is injected as a section inside every AI system prompt so the
  // model knows exactly what the student has done and what to avoid.

  const buildMemoryContext = useCallback(
    (ctx: StudyMemoryContext, currentTopic?: string): string => {
      if (!ctx.hasMemory) return '';

      const lines: string[] = [
        '=== STUDENT STUDY MEMORY ===',
        '(Use this to diversify content, avoid repetition, and target weak areas.)',
        '',
      ];

      // ── Recent daily activity (last 7 days) ──────────────────────────────
      if (ctx.recentDays.length > 0) {
        lines.push('📅 RECENT DAILY ACTIVITY:');
        ctx.recentDays.forEach((d) => {
          const parts = [`• ${d.studyDate}`];
          if (d.topicsStudied.length) parts.push(`topics: ${d.topicsStudied.join(', ')}`);
          if (d.quizCount > 0) parts.push(`quizzes ${d.quizCorrect}/${d.quizCount}`);
          if (d.flashcardCount > 0) parts.push(`flashcards: ${d.flashcardCount}`);
          if (d.examCount > 0) parts.push(`exams: ${d.examCount}`);
          if (d.avgScorePct != null) parts.push(`avg score: ${d.avgScorePct}%`);
          lines.push(parts.join(' | '));
        });
        lines.push('');
      }

      // ── Topics needing reinforcement ─────────────────────────────────────
      if (ctx.topicsNeedingReinforcement.length > 0) {
        lines.push(
          `⚠ TOPICS NEEDING REINFORCEMENT (avg score < 60%): ${ctx.topicsNeedingReinforcement.join(', ')}`
        );
        lines.push('→ Prioritise questions and flashcards on these topics today.');
        lines.push('');
      }

      // ── Weak concepts across all topics ─────────────────────────────────
      if (ctx.allWeakConcepts.length > 0) {
        lines.push(
          `🔴 WEAK CONCEPTS (student repeatedly gets these wrong): ${ctx.allWeakConcepts.slice(0, 12).join(', ')}`
        );
        lines.push('→ Target these concepts specifically in new questions.');
        lines.push('');
      }

      // ── Current topic memory (if scoped to one topic) ────────────────────
      const relevantTopics = currentTopic
        ? ctx.topicSummaries.filter(
            (t) => t.topicName.toLowerCase() === currentTopic.toLowerCase()
          )
        : ctx.topicSummaries.slice(0, 5);

      relevantTopics.forEach((t) => {
        lines.push(`📚 TOPIC: ${t.topicName}`);

        if (t.subtopicsCovered.length > 0) {
          lines.push(`  Subtopics already covered: ${t.subtopicsCovered.join(', ')}`);
        }
        if (t.conceptsCovered.length > 0) {
          lines.push(`  Concepts seen: ${t.conceptsCovered.slice(0, 12).join(', ')}`);
        }
        if (t.conceptsWeak.length > 0) {
          lines.push(`  ⚠ Weak (prioritise): ${t.conceptsWeak.join(', ')}`);
        }
        if (t.conceptsMastered.length > 0) {
          lines.push(`  ✓ Mastered (reduce emphasis): ${t.conceptsMastered.slice(0, 8).join(', ')}`);
        }
        if (t.quizAttempts > 0) {
          lines.push(
            `  Quiz: ${t.quizCorrect}/${t.quizAttempts} correct` +
            (t.avgScorePct != null ? ` | avg ${t.avgScorePct}%` : '') +
            (t.bestScorePct != null ? ` | best ${t.bestScorePct}%` : '')
          );
        }
        if (t.commandWordsUsed.length > 0) {
          lines.push(`  Command words used recently: ${t.commandWordsUsed.join(', ')}`);
          lines.push(`  → Vary with different command words this session.`);
        }
        if (t.questionsSeen.length > 0) {
          lines.push(
            `  QUESTIONS ALREADY ASKED (DO NOT repeat these exactly):\n` +
            t.questionsSeen
              .slice(0, 8)
              .map((q) => `    - "${q}"`)
              .join('\n')
          );
        }
        if (t.needsReinforcement) {
          lines.push('  ⚠ This topic needs reinforcement — ask more questions here today.');
        }
        if (t.topicComplete) {
          lines.push('  ✓ This topic appears fully covered — suggest moving to the next topic.');
        }
        lines.push('');
      });

      lines.push('=== END STUDY MEMORY ===');
      return lines.join('\n');
    },
    []
  );

  // ── Convenience extractors from AI response ──────────────────────────────
  // Call these after the AI returns a quiz/flashcard/task response to extract
  // concepts_tested so logEvent can persist them.

  const extractConcepts = useCallback((text: string): string[] => {
    if (!text) return [];
    // Very simple heuristic: split on common separators and clean up.
    // The AI is also asked to return a `conceptsTested` array in JSON mode.
    const words = text
      .split(/[,;|\n•\-–—]/)
      .map((w) => w.trim())
      .filter((w) => w.length > 3 && w.length < 60);
    return [...new Set(words)].slice(0, 10);
  }, []);

  return {
    logEvent,
    fetchMemoryContext,
    buildMemoryContext,
    extractConcepts,
  };
}
