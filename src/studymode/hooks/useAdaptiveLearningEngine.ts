/**
 * useAdaptiveLearningEngine.ts
 *
 * The central adaptive learning engine for StudySync.
 *
 * This hook:
 *  1. Builds a rich context from profile + subjects + performance + documents
 *  2. Calls generate-study-plan edge function to create/regenerate AI study plans
 *  3. Calls generate-flashcards edge function for topic flashcards
 *  4. Monitors task completion and triggers plan adaptation at 70% threshold
 *  5. Provides a unified interface for all adaptive learning actions
 *
 * Triggers:
 *  - manual:      user clicks "Generate Plan"
 *  - onSignup:    called once after academic profile is saved
 *  - onUpload:    called after a document is parsed (syllabus/past-paper)
 *  - onProgress:  auto-called when completionRate crosses 70%
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { aiRequestJSON } from '../lib/aiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudyPlanItem {
  subject: string;
  subject_id: string | null;
  topic: string;
  task_type: string;
  date: string;
  duration_minutes: number;
  task_description: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  topic: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
}

export interface PerformanceSummary {
  weakTopics: string[];
  strongTopics: string[];
  overallAccuracy: number;
  completionRate: number;
  subjectBreakdown: Record<string, { accuracy: number; attempted: number }>;
}

export interface AdaptiveEngineState {
  isGeneratingPlan: boolean;
  isGeneratingFlashcards: boolean;
  lastPlanGenerated: Date | null;
  performanceSummary: PerformanceSummary | null;
  error: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ADAPTATION_THRESHOLD = 0.7; // 70% completion triggers adaptive regen
const PLAN_COOLDOWN_HOURS = 12;   // Don't regenerate more often than this

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdaptiveLearningEngine() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AdaptiveEngineState>({
    isGeneratingPlan: false,
    isGeneratingFlashcards: false,
    lastPlanGenerated: null,
    performanceSummary: null,
    error: null,
  });
  const adaptationCheckRef = useRef(false);

  // ── Context Builder ──────────────────────────────────────────────────────

  /**
   * Assembles the full context payload for AI calls.
   * Pulls: profile, subjects (with topics), performance, syllabus docs, past papers.
   */
  const buildContext = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Academic profile
    const { data: profileData } = await supabase
      .from('academic_profiles' as any)
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // 2. Subjects with topics
    const { data: subjectsData } = await supabase
      .from('subjects')
      .select('id, name, topics')
      .eq('user_id', user.id);

    // 3. Performance data (quiz_attempts)
    const { data: attemptsData } = await supabase
      .from('quiz_attempts' as any)
      .select('topic_name, subject_id, was_correct, difficulty_rating, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    // 4. Study schedule completion
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
    const { data: scheduleData } = await supabase
      .from('study_schedule' as any)
      .select('is_completed, topic_name, subject_id, scheduled_date')
      .eq('user_id', user.id)
      .gte('scheduled_date', thirtyDaysAgo)
      .lte('scheduled_date', today);

    // 5. Parsed documents (syllabus + past papers)
    const { data: docsData } = await supabase
      .from('documents')
      .select('type, subject, parsed_content, is_processed')
      .eq('user_id', user.id)
      .eq('is_processed', true)
      .in('type', ['syllabus', 'past_paper']);

    // 6. Exam settings
    const { data: examData } = await supabase
      .from('exam_settings' as any)
      .select('exam_date, exam_name')
      .eq('user_id', user.id)
      .maybeSingle();

    // ── Build performance summary ──────────────────────────────────────────
    const attempts = (attemptsData || []) as any[];
    const schedule = (scheduleData || []) as any[];
    const subjects = (subjectsData || []) as any[];

    const subjectBreakdown: Record<string, { accuracy: number; attempted: number }> = {};
    const topicAccuracy: Record<string, { correct: number; total: number }> = {};

    attempts.forEach((a) => {
      const topic = a.topic_name || 'Unknown';
      if (!topicAccuracy[topic]) topicAccuracy[topic] = { correct: 0, total: 0 };
      topicAccuracy[topic].total++;
      if (a.was_correct) topicAccuracy[topic].correct++;

      // Map to subject
      const subj = subjects.find((s: any) => s.id === a.subject_id);
      if (subj) {
        if (!subjectBreakdown[subj.name]) subjectBreakdown[subj.name] = { accuracy: 0, attempted: 0 };
        subjectBreakdown[subj.name].attempted++;
        if (a.was_correct) subjectBreakdown[subj.name].accuracy++;
      }
    });

    // Normalise subject accuracy to 0-1
    Object.keys(subjectBreakdown).forEach((k) => {
      const s = subjectBreakdown[k];
      s.accuracy = s.attempted > 0 ? s.accuracy / s.attempted : 0;
    });

    const totalAttempts = attempts.length;
    const totalCorrect = attempts.filter((a) => a.was_correct).length;
    const overallAccuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

    const completedTasks = schedule.filter((s) => s.is_completed).length;
    const completionRate = schedule.length > 0 ? completedTasks / schedule.length : 0;

    const weakTopics = Object.entries(topicAccuracy)
      .filter(([, v]) => v.total >= 3 && v.correct / v.total < 0.6)
      .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
      .map(([topic]) => topic)
      .slice(0, 8);

    const strongTopics = Object.entries(topicAccuracy)
      .filter(([, v]) => v.total >= 3 && v.correct / v.total >= 0.8)
      .map(([topic]) => topic)
      .slice(0, 5);

    const performanceSummary: PerformanceSummary = {
      weakTopics,
      strongTopics,
      overallAccuracy,
      completionRate,
      subjectBreakdown,
    };

    // ── Build syllabus / past-paper context strings ───────────────────────
    const docs = (docsData || []) as any[];
    let syllabusContext = '';
    let pastPaperContext = '';

    docs.forEach((doc) => {
      const content = doc.parsed_content;
      if (!content) return;

      if (doc.type === 'syllabus' && content.topics) {
        const topicList = (content.topics as any[])
          .slice(0, 20)
          .map((t: any) =>
            `- ${t.name}` +
            (t.examWeight ? ` (${t.examWeight}% weight)` : '') +
            (t.subtopics?.length ? `: ${t.subtopics.slice(0, 3).join(', ')}` : '')
          )
          .join('\n');
        syllabusContext += `[${doc.subject}]\n${topicList}\n\n`;
      }

      if (doc.type === 'past_paper' && content.questions) {
        const qList = (content.questions as any[])
          .slice(0, 10)
          .map((q: any) =>
            `Q${q.question_number || ''}: ${q.topic || 'Unknown'} ` +
            `[${q.marks || '?'}m, ${q.difficulty || 'med'}]` +
            (q.command_words?.length ? ` - ${q.command_words[0]}` : '')
          )
          .join('\n');
        pastPaperContext += `[${doc.subject}]\n${qList}\n\n`;
      }
    });

    // ── Build performance context string for AI ───────────────────────────
    const perfContext =
      attempts.length > 0
        ? `Overall accuracy: ${Math.round(overallAccuracy * 100)}%\n` +
          `Tasks completed: ${completedTasks}/${schedule.length} (${Math.round(completionRate * 100)}%)\n` +
          (weakTopics.length
            ? `⚠ WEAK topics (need more practice): ${weakTopics.join(', ')}\n`
            : '') +
          (strongTopics.length
            ? `✓ Strong topics (reduce time): ${strongTopics.join(', ')}\n`
            : '') +
          Object.entries(subjectBreakdown)
            .map(([name, s]) => `${name}: ${Math.round(s.accuracy * 100)}% accuracy (${s.attempted} attempts)`)
            .join('\n')
        : '';

    return {
      user,
      profile: profileData,
      subjects,
      examDate: examData?.exam_date || null,
      examName: examData?.exam_name || null,
      syllabusContext,
      pastPaperContext,
      performanceContext: perfContext,
      performanceSummary,
      completionRate,
    };
  }, []);

  // ── Generate / Regenerate Study Plan ─────────────────────────────────────

  const generateStudyPlan = useCallback(
    async (mode: 'initial' | 'adaptive' = 'initial') => {
      setState((prev) => ({ ...prev, isGeneratingPlan: true, error: null }));

      try {
        const ctx = await buildContext();

        const result = await aiRequestJSON<{ plan: StudyPlanItem[]; saved: number }>(
          'generate-study-plan',
          {
            profile: ctx.profile,
            subjects: ctx.subjects,
            examDate: ctx.examDate,
            performanceContext: ctx.performanceContext,
            syllabusContext: ctx.syllabusContext,
            pastPaperContext: ctx.pastPaperContext,
            mode,
            userId: ctx.user.id,
          }
        );

        // Store last generated timestamp
        const now = new Date();
        localStorage.setItem('lastPlanGenerated', now.toISOString());

        setState((prev) => ({
          ...prev,
          isGeneratingPlan: false,
          lastPlanGenerated: now,
          performanceSummary: ctx.performanceSummary,
        }));

        // Invalidate schedule queries so UI re-renders
        queryClient.invalidateQueries({ queryKey: ['study-schedule'] });

        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setState((prev) => ({ ...prev, isGeneratingPlan: false, error: msg }));
        throw err;
      }
    },
    [buildContext, queryClient]
  );

  // ── Generate Flashcards ───────────────────────────────────────────────────

  const generateFlashcards = useCallback(
    async (
      subject: string,
      topic: string,
      options: { count?: number; difficulty?: string } = {}
    ): Promise<Flashcard[]> => {
      setState((prev) => ({ ...prev, isGeneratingFlashcards: true, error: null }));

      try {
        // Fetch syllabus context for this specific topic
        const { data: docsData } = await supabase
          .from('documents')
          .select('parsed_content, type')
          .eq('user_id', (await supabase.auth.getUser()).data.user!.id)
          .eq('is_processed', true)
          .ilike('subject', `%${subject}%`);

        let syllabusContext = '';
        let pastPaperContext = '';
        (docsData || []).forEach((doc: any) => {
          if (doc.type === 'syllabus' && doc.parsed_content?.topics) {
            const t = (doc.parsed_content.topics as any[]).find((t: any) =>
              t.name?.toLowerCase().includes(topic.toLowerCase()) ||
              topic.toLowerCase().includes(t.name?.toLowerCase() || '')
            );
            if (t) {
              syllabusContext = `Topic: ${t.name}\n`;
              if (t.subtopics?.length) syllabusContext += `Subtopics: ${t.subtopics.join(', ')}\n`;
              if (t.learningObjectives?.length) syllabusContext += `Objectives: ${t.learningObjectives.join('; ')}\n`;
              if (t.concepts?.length) syllabusContext += `Key concepts: ${t.concepts.join(', ')}\n`;
            }
          }
          if (doc.type === 'past_paper' && doc.parsed_content?.questions) {
            const qs = (doc.parsed_content.questions as any[]).filter((q: any) =>
              q.topic?.toLowerCase().includes(topic.toLowerCase())
            );
            if (qs.length) {
              pastPaperContext = qs
                .slice(0, 5)
                .map((q: any) => `[${q.marks}m] ${q.command_words?.join(', ') || ''}: ${q.subtopic || q.topic}`)
                .join('\n');
            }
          }
        });

        const result = await aiRequestJSON<{ flashcards: Flashcard[]; count: number }>(
          'generate-flashcards',
          {
            subject,
            topic,
            syllabusContext,
            pastPaperContext,
            count: options.count || 8,
            difficulty: options.difficulty || 'mixed',
          }
        );

        setState((prev) => ({ ...prev, isGeneratingFlashcards: false }));
        return result.flashcards || [];
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setState((prev) => ({ ...prev, isGeneratingFlashcards: false, error: msg }));
        throw err;
      }
    },
    []
  );

  // ── Adaptive Trigger: watch completion rate ───────────────────────────────

  const checkAndAdapt = useCallback(async () => {
    if (adaptationCheckRef.current) return;

    const lastGenStr = localStorage.getItem('lastPlanGenerated');
    if (lastGenStr) {
      const lastGen = new Date(lastGenStr);
      const hoursSince = (Date.now() - lastGen.getTime()) / 3_600_000;
      if (hoursSince < PLAN_COOLDOWN_HOURS) return; // cooldown active
    }

    try {
      adaptationCheckRef.current = true;
      const ctx = await buildContext();

      if (ctx.completionRate >= ADAPTATION_THRESHOLD) {
        console.log(
          `[AdaptiveEngine] Completion rate ${Math.round(ctx.completionRate * 100)}% ≥ ${ADAPTATION_THRESHOLD * 100}% — regenerating adaptive plan`
        );
        await generateStudyPlan('adaptive');
      }
    } finally {
      adaptationCheckRef.current = false;
    }
  }, [buildContext, generateStudyPlan]);

  // ── Auto-check adaptation on mount ───────────────────────────────────────

  useEffect(() => {
    // Delay to avoid blocking initial render
    const timer = setTimeout(() => {
      checkAndAdapt().catch(console.warn);
    }, 5000);
    return () => clearTimeout(timer);
  }, [checkAndAdapt]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Call this after signup + academic profile save */
  const onSignupComplete = useCallback(async () => {
    await generateStudyPlan('initial');
  }, [generateStudyPlan]);

  /** Call this after a document is parsed */
  const onDocumentUploaded = useCallback(async () => {
    // Regenerate plan with fresh syllabus/past-paper context
    await generateStudyPlan('initial');
  }, [generateStudyPlan]);

  /** Refresh the performance summary without generating a new plan */
  const refreshPerformance = useCallback(async () => {
    const ctx = await buildContext();
    setState((prev) => ({ ...prev, performanceSummary: ctx.performanceSummary }));
    return ctx.performanceSummary;
  }, [buildContext]);

  return {
    ...state,
    generateStudyPlan,
    generateFlashcards,
    onSignupComplete,
    onDocumentUploaded,
    checkAndAdapt,
    refreshPerformance,
  };
}
