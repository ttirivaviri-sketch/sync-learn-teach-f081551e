import { useState, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { aiRequestJSON } from '../lib/aiClient';
import { useSubjectXP } from './useSubjectXP';
import { useWeakConcepts } from './useWeakConcepts';
import { logger } from '@/utils/logger';

export interface ConceptMap {
  topic: string;
  subtopic: string;
  concepts: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  exam_expectation: string;
}

export interface SessionQuestion {
  question: string;
  expected_answer: string;
  concept_map: ConceptMap;
}

export interface EvalResult {
  accuracy: boolean;
  coverage_score: number;
  expression_score: number;
  missing_points: string[];
  improvement_needed: boolean;
  level: 'exam_ready' | 'close' | 'developing' | 'weak';
  feedback: string;
  xp_delta: number;
}

export interface ConceptReview {
  quick_review: { bullets: string[]; formulas: string[]; definitions: string[] };
  full_explanation: string;
  examples: string[];
  common_mistakes: string[];
  testing_focus: string[];
}

const MAX_QUESTIONS = 20;

interface StartArgs {
  subject: string;
  topic: string;
  subtopic?: string;
  curriculum?: string;
  subjectId?: string;
}

export function useTopicSessionRunner() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>('');
  const [curriculum, setCurriculum] = useState<string>('ZIMSEC');
  const [topic, setTopic] = useState<string>('');
  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [conceptLearning, setConceptLearning] = useState<string>('');
  const [quickReview, setQuickReview] = useState<string[]>([]);
  const [sessionXP, setSessionXP] = useState(0);
  const [questionsAttempted, setQuestionsAttempted] = useState(0);
  const [questionsCorrect, setQuestionsCorrect] = useState(0);
  const [conceptReviewCount, setConceptReviewCount] = useState(0);
  const [reviewBlocked, setReviewBlocked] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [lastResult, setLastResult] = useState<EvalResult | null>(null);
  const [lastReview, setLastReview] = useState<ConceptReview | null>(null);

  const { awardXP } = useSubjectXP();
  const { weakConcepts, recordWeakness } = useWeakConcepts(subject, curriculum);

  const updateActivity = useCallback(async (id: string, patch: Record<string, any>) => {
    await supabase
      .from('topic_sessions' as any)
      .update({ ...patch, last_activity_at: new Date().toISOString() })
      .eq('id', id);
  }, []);

  const startSession = useCallback(async (args: StartArgs) => {
    setIsStarting(true);
    try {
      // Auto-expire stale
      await supabase.rpc('expire_stale_topic_sessions' as any);

      const curr = args.curriculum || 'ZIMSEC';
      setSubject(args.subject);
      setCurriculum(curr);
      setTopic(args.topic);

      // Open session row
      const { data: newId, error: rpcErr } = await supabase.rpc('start_topic_session' as any, {
        p_subject_name: args.subject,
        p_topic_name: args.topic,
        p_curriculum: curr,
        p_subject_id: args.subjectId ?? null,
        p_topic_id: null,
        p_subtopic: args.subtopic ?? null,
      });
      if (rpcErr) throw rpcErr;
      const sid = newId as unknown as string;
      setSessionId(sid);

      // Generate content (biased to weak concepts)
      const weakNames = weakConcepts.slice(0, 5).map(w => w.concept);
      const content = await aiRequestJSON<{
        concept_learning: string;
        quick_review: string[];
        questions: SessionQuestion[];
        flashcards: { front: string; back: string }[];
      }>('generate-topic-session', {
        subject: args.subject,
        curriculum: curr,
        topic: args.topic,
        subtopic: args.subtopic,
        weak_concepts: weakNames,
      });

      const safeQs = (content.questions || []).slice(0, MAX_QUESTIONS);
      setQuestions(safeQs);
      setConceptLearning(content.concept_learning || '');
      setQuickReview(content.quick_review || []);
      setCurrentIndex(0);
      setSessionXP(0);
      setQuestionsAttempted(0);
      setQuestionsCorrect(0);
      setConceptReviewCount(0);
      setReviewBlocked(false);
      setLastResult(null);
      setLastReview(null);

      return sid;
    } catch (e) {
      logger.error('[useTopicSessionRunner] startSession failed', e);
      throw e;
    } finally {
      setIsStarting(false);
    }
  }, [weakConcepts]);

  const requestReview = useCallback(async (depth: 'quick' | 'full' = 'quick') => {
    const q = questions[currentIndex];
    if (!q || !sessionId) return null;
    setIsReviewing(true);
    try {
      const review = await aiRequestJSON<ConceptReview>('generate-concept-review', {
        question: q.question,
        concept_map: q.concept_map,
        depth,
      });
      setLastReview(review);
      const nextCount = conceptReviewCount + 1;
      setConceptReviewCount(nextCount);
      // Review-farming guard
      if (questionsAttempted > 0 && nextCount / Math.max(1, questionsAttempted) > 2) {
        setReviewBlocked(true);
      }
      await updateActivity(sessionId, { concept_review_count: nextCount });
      return review;
    } catch (e) {
      logger.error('[useTopicSessionRunner] requestReview failed', e);
      return null;
    } finally {
      setIsReviewing(false);
    }
  }, [questions, currentIndex, sessionId, conceptReviewCount, questionsAttempted, updateActivity]);

  const submitAnswer = useCallback(async (answer: string) => {
    const q = questions[currentIndex];
    if (!q || !sessionId) return null;
    setIsEvaluating(true);
    try {
      const result = await aiRequestJSON<EvalResult>('evaluate-topic-answer', {
        question: q.question,
        expected_answer: q.expected_answer,
        student_answer: answer,
        concept_map: q.concept_map,
      });

      // Clamp session XP at 0 floor
      const xpDelta = result.xp_delta ?? 0;
      const newSessionXp = Math.max(0, sessionXP + xpDelta);
      const xpAdded = newSessionXp - sessionXP;
      setSessionXP(newSessionXp);

      const nextAttempted = questionsAttempted + 1;
      const nextCorrect = questionsCorrect + (result.accuracy ? 1 : 0);
      setQuestionsAttempted(nextAttempted);
      setQuestionsCorrect(nextCorrect);
      setLastResult(result);

      // Reset review block once they actually attempted
      if (reviewBlocked) setReviewBlocked(false);

      // Persist question audit
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('topic_session_questions' as any).insert({
          session_id: sessionId,
          user_id: user.id,
          question_text: q.question,
          expected_answer: q.expected_answer,
          student_answer: answer,
          concept_map: q.concept_map,
          accuracy: result.accuracy,
          coverage_score: result.coverage_score,
          expression_score: result.expression_score,
          missing_points: result.missing_points || [],
          improvement_needed: result.improvement_needed,
          level: result.level,
          xp_delta: xpDelta,
        });
      }

      // Update session row
      const masteryScore = nextAttempted > 0 ? Math.round((nextCorrect / nextAttempted) * 100) : 0;
      await updateActivity(sessionId, {
        questions_attempted: nextAttempted,
        questions_correct: nextCorrect,
        mastery_score: masteryScore,
        session_xp: newSessionXp,
      });

      // Award subject XP (feeds leaderboards) — only positive contributions
      if (xpAdded > 0) {
        awardXP.mutate({ subject, curriculum, amount: xpAdded });
      }

      // Update weak-concept memory
      if (result.level === 'exam_ready' && q.concept_map?.concepts?.length) {
        recordWeakness.mutate({ concepts: q.concept_map.concepts, topic: q.concept_map.topic, delta: -0.1 });
      } else if ((result.level === 'developing' || result.level === 'weak') && q.concept_map?.concepts?.length) {
        recordWeakness.mutate({ concepts: q.concept_map.concepts, topic: q.concept_map.topic, delta: +0.15 });
      }

      return result;
    } catch (e) {
      logger.error('[useTopicSessionRunner] submitAnswer failed', e);
      return null;
    } finally {
      setIsEvaluating(false);
    }
  }, [questions, currentIndex, sessionId, sessionXP, questionsAttempted, questionsCorrect, reviewBlocked, subject, curriculum, awardXP, recordWeakness, updateActivity]);

  const nextQuestion = useCallback(() => {
    setLastResult(null);
    setLastReview(null);
    setCurrentIndex(i => Math.min(i + 1, questions.length));
  }, [questions.length]);

  const endSession = useCallback(async () => {
    if (!sessionId) return;
    await supabase
      .from('topic_sessions' as any)
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }, [sessionId]);

  const currentQuestion = questions[currentIndex] || null;
  const isFinished = questions.length > 0 && currentIndex >= questions.length;

  return {
    // state
    sessionId,
    subject,
    curriculum,
    topic,
    questions,
    currentIndex,
    currentQuestion,
    conceptLearning,
    quickReview,
    sessionXP,
    questionsAttempted,
    questionsCorrect,
    isFinished,
    reviewBlocked,
    lastResult,
    lastReview,
    // status
    isStarting,
    isEvaluating,
    isReviewing,
    // actions
    startSession,
    requestReview,
    submitAnswer,
    nextQuestion,
    endSession,
  };
}
