/**
 * useRecallEngine — Unified React hook for the Active Recall & Mastery system
 *
 * Connects the pure-logic recallEngine.ts to the React UI. Manages:
 *   - Question pools (generating 10+ questions per topic)
 *   - One-at-a-time question presentation
 *   - Semantic answer evaluation via AI
 *   - Mastery tracking per topic (accuracy + improvement + consistency)
 *   - Spaced repetition scheduling
 *   - Adaptive difficulty selection
 *   - Data loop: every answer → mastery → question selection → personalization
 *   - Session statistics
 *   - Insights generation
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { aiRequestJSON } from '../lib/aiClient';
import { useSyllabusContext } from './useSyllabusContext';
import { useTopicPerformance } from './useTopicPerformance';
import { useSpacedRepetition } from './useSpacedRepetition';
import { useConceptMastery } from './useConceptMastery';
import { useUserProgress } from './useUserProgress';
import { Subject, Topic } from '../types/study';
import {
  RecallQuestion,
  SemanticEvaluation,
  AnswerRecord,
  TopicMastery,
  StudentInsight,
  SessionStats,
  DifficultyLevel,
  MasteryClassification,
  calculateSM2,
  classifyMastery,
  calculateImprovementTrend,
  calculateConsistencyScore,
  recommendDifficulty,
  computeSelectionWeight,
  generateInsightsFromHistory,
  computeSessionStats,
} from '../engine/recallEngine';
import { logger } from '@/utils/logger';

// ── Types ──────────────────────────────────────────────────────────────────

export type RecallMode = 'active-recall' | 'exam';

export interface RecallEngineState {
  mode: RecallMode;
  /** Questions pool for the current session */
  questions: RecallQuestion[];
  /** Currently active question index */
  currentIndex: number;
  /** All answers recorded this session */
  answers: AnswerRecord[];
  /** Per-topic mastery data */
  masteries: Map<string, TopicMastery>;
  /** Generated insights */
  insights: StudentInsight[];
  /** Session stats */
  sessionStats: SessionStats | null;
  /** Is a question batch being generated? */
  isGenerating: boolean;
  /** Is AI currently evaluating an answer? */
  isEvaluating: boolean;
  /** Current adaptive difficulty */
  difficulty: DifficultyLevel;
  /** Error message */
  error: string | null;
  /** Session start timestamp */
  sessionStartTime: number;
  /** Has the session been completed? */
  isComplete: boolean;
  /** Exam mode timer (seconds remaining) */
  examTimeRemaining: number | null;
}

interface UseRecallEngineOptions {
  subject: Subject;
  topic?: Topic;
  mode?: RecallMode;
  questionCount?: number;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useRecallEngine({ subject, topic, mode = 'active-recall', questionCount = 10 }: UseRecallEngineOptions) {
  const activeTopic = topic || subject.currentTopic;

  const [state, setState] = useState<RecallEngineState>({
    mode,
    questions: [],
    currentIndex: 0,
    answers: [],
    masteries: new Map(),
    insights: [],
    sessionStats: null,
    isGenerating: false,
    isEvaluating: false,
    difficulty: 'standard',
    error: null,
    sessionStartTime: Date.now(),
    isComplete: false,
    examTimeRemaining: null,
  });

  const [userId, setUserId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get user ID
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null);
    });
  }, []);

  // Existing hooks for integration
  const { curriculumContext, examPatterns, isLoaded: contextLoaded } = useSyllabusContext(subject.id, activeTopic?.name);
  const { performance } = useTopicPerformance(subject.id, activeTopic?.name);
  const { recordAttempt, topicStats, getStrugglingTopics } = useSpacedRepetition(userId);
  const { checkAndUpdateMastery } = useConceptMastery();
  const { addXp, updateStreak } = useUserProgress();

  // Compute initial difficulty from existing performance
  useEffect(() => {
    if (performance) {
      const diff: DifficultyLevel =
        performance.accuracy >= 0.8 ? 'advanced' :
        performance.accuracy < 0.4 ? 'foundation' : 'standard';
      setState(prev => ({ ...prev, difficulty: diff }));
    }
  }, [performance]);

  // ── Generate Question Batch ──────────────────────────────────────────────

  const generateQuestions = useCallback(async (count?: number) => {
    const numQuestions = count || questionCount;

    setState(prev => ({ ...prev, isGenerating: true, error: null }));

    try {
      // Build performance context
      let perfContext = '';
      if (performance && performance.totalAttempts > 0) {
        perfContext = `Accuracy: ${Math.round(performance.accuracy * 100)}%, `;
        perfContext += `Mastery: ${performance.masteryStatus}, `;
        if (performance.weakConcepts.length > 0) {
          perfContext += `Weak concepts: ${performance.weakConcepts.join(', ')}. `;
        }
      }

      // Build struggling topics context for spaced repetition
      const struggling = getStrugglingTopics();
      const dueTopics = topicStats.filter(t => t.due_for_review);

      // Get past answers for this session to avoid repetition
      const recentQuestions = state.answers.map(a => a.question).slice(-5);

      const payload = {
        subject: subject.name,
        topic: activeTopic.name,
        subtopics: activeTopic.subtopics || [],
        count: numQuestions,
        difficulty: state.difficulty,
        mode: state.mode,
        curriculumContext: curriculumContext || undefined,
        performanceContext: perfContext || undefined,
        examPatterns: examPatterns?.slice(0, 5) || [],
        weakConcepts: performance?.weakConcepts || [],
        recentQuestions: recentQuestions,
        // For spaced repetition: include previously incorrect topics
        spacedRepetitionContext: {
          strugglingTopics: struggling.map(t => t.topic_name).slice(0, 3),
          dueForReview: dueTopics.map(t => t.topic_name).slice(0, 3),
        },
        // Question variety requirements
        questionTypes: ['multiple_choice', 'short_answer', 'structured', 'explain', 'application'],
        includeMarks: true,
        includeModelAnswers: true,
        includeMarkingSchemes: true,
        examMode: state.mode === 'exam',
      };

      const data = await aiRequestJSON<any>('generate-quiz', payload);

      // Parse response - handle both array and wrapped formats
      let rawQuestions: any[] = [];
      if (Array.isArray(data.quiz)) {
        rawQuestions = data.quiz;
      } else if (Array.isArray(data.questions)) {
        rawQuestions = data.questions;
      } else if (Array.isArray(data)) {
        rawQuestions = data;
      } else if (data.question) {
        rawQuestions = [data];
      }

      // Map to RecallQuestion format
      const questions: RecallQuestion[] = rawQuestions.map((q: any, index: number) => {
        const isPreviouslyIncorrect = struggling.some(s =>
          q.topic?.toLowerCase().includes(s.topic_name.toLowerCase())
        );
        const isDueForReview = dueTopics.some(d =>
          q.topic?.toLowerCase().includes(d.topic_name.toLowerCase())
        );
        const targetsWeakConcepts = (performance?.weakConcepts || []).some(wc =>
          (q.conceptsTested || []).some((ct: string) => ct.toLowerCase().includes(wc.toLowerCase()))
        );

        return {
          id: q.id || crypto.randomUUID(),
          question: q.question,
          questionType: q.questionType || 'structured',
          marks: q.marks || 4,
          topic: q.topic || activeTopic.name,
          subtopic: q.subtopic,
          subject: subject.name,
          subjectId: subject.id,
          difficulty: q.difficulty || state.difficulty,
          commandWord: q.commandWord || q.commandWords?.[0],
          keyConcepts: q.keyConcepts || q.keyPoints || [],
          modelAnswer: q.modelAnswer || '',
          markingScheme: q.markingScheme || [],
          stepByStepSolution: q.stepByStepSolution,
          options: q.options,
          correctOption: q.correctOption,
          timeAllocationSecs: q.timeAllocation ? parseInt(q.timeAllocation) : (q.marks || 4) * 90,
          isPreviouslyIncorrect,
          selectionWeight: computeSelectionWeight({
            isPreviouslyIncorrect,
            isDueForReview,
            targetsWeakConcepts,
            daysSinceLastAttempt: null,
          }),
          conceptsTested: q.conceptsTested || [],
          source: isPreviouslyIncorrect ? 'spaced-review' : 'ai-generated',
          visual: q.visual ?? null,
        };
      });

      // Sort by selection weight (highest first for spaced repetition priority)
      questions.sort((a, b) => b.selectionWeight - a.selectionWeight);

      // Calculate total time for exam mode
      const totalTimeSecs = state.mode === 'exam'
        ? questions.reduce((sum, q) => sum + q.timeAllocationSecs, 0)
        : null;

      setState(prev => ({
        ...prev,
        questions: [...prev.questions, ...questions],
        isGenerating: false,
        examTimeRemaining: prev.examTimeRemaining === null ? totalTimeSecs : prev.examTimeRemaining,
        sessionStartTime: prev.questions.length === 0 ? Date.now() : prev.sessionStartTime,
      }));

      return questions;
    } catch (err) {
      logger.error('[useRecallEngine] Question generation error:', err);
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: err instanceof Error ? err.message : 'Failed to generate questions',
      }));
      return [];
    }
  }, [subject, activeTopic, state.difficulty, state.mode, state.answers, performance, curriculumContext, examPatterns, getStrugglingTopics, topicStats, questionCount]);

  // ── Evaluate Answer (Semantic) ───────────────────────────────────────────

  const evaluateAnswer = useCallback(async (
    questionIndex: number,
    userAnswer: string,
    timeTakenSecs: number,
  ): Promise<SemanticEvaluation | null> => {
    const question = state.questions[questionIndex];
    if (!question) return null;

    setState(prev => ({ ...prev, isEvaluating: true }));

    try {
      const result = await aiRequestJSON<any>('mark-answer', {
        question: question.question,
        studentAnswer: userAnswer,
        modelAnswer: question.modelAnswer,
        markingScheme: question.markingScheme,
        keyPoints: question.keyConcepts,
        totalMarks: question.marks,
        topic: question.topic,
        subject: question.subject,
        conceptsTested: question.conceptsTested,
        commandWord: question.commandWord,
        difficulty: question.difficulty,
        mode: 'mark',
        examStrict: state.mode === 'exam',
        stream: false,
        // AI logic requirements
        evaluationInstructions: [
          'Support paraphrased correct answers - do not require exact wording',
          'Detect incorrect reasoning beyond simple keyword matching',
          'Explain WHY each wrong part is wrong with specific reasoning',
          'Extract key concepts from the student answer and compare semantically',
          'Score 0-100 based on concept coverage and reasoning quality',
          'Identify specific misconceptions, not just missing content',
        ].join('. '),
      });

      const evaluation: SemanticEvaluation = {
        score: result.score ?? Math.round((result.percentage ?? 0)),
        totalMarks: result.totalMarks ?? question.marks,
        marksAwarded: result.score ?? Math.round((result.percentage ?? 0) * question.marks / 100),
        percentage: result.percentage ?? Math.round((result.score ?? 0) / question.marks * 100),
        correctConcepts: result.correctParts || result.correctConcepts || [],
        missingConcepts: result.missingConcepts || [],
        misconceptions: result.misconceptions || [],
        feedback: {
          whatWasCorrect: result.correctParts?.join('. ') || result.feedback?.whatWasCorrect || '',
          whatWasMissing: result.missingConcepts?.join('. ') || result.feedback?.whatWasMissing || '',
          whatWasMisunderstood: result.misconceptions?.join('. ') || result.feedback?.whatWasMisunderstood || '',
          modelAnswer: question.modelAnswer,
          lostMarksExplanation: result.feedback?.lostMarksExplanation || result.feedback || '',
          reasoningErrors: result.reasoningErrors || result.mistakes || [],
        },
        markBreakdown: result.markBreakdown || [],
        improvementTips: result.improvementTips || [],
      };

      // ── DATA LOOP: Record answer and update all systems ──────────────────

      const answerRecord: AnswerRecord = {
        questionId: question.id,
        question: question.question,
        userAnswer,
        topic: question.topic,
        subtopic: question.subtopic,
        subject: question.subject,
        subjectId: question.subjectId,
        difficulty: question.difficulty,
        evaluation,
        conceptsTested: question.conceptsTested,
        commandWord: question.commandWord,
        timestamp: new Date().toISOString(),
        timeTakenSecs,
        isExamMode: state.mode === 'exam',
      };

      // 1. Add to session answers
      const newAnswers = [...state.answers, answerRecord];

      // 2. Record in spaced repetition system
      const wasCorrect = evaluation.percentage >= 50;
      if (userId) {
        await recordAttempt(
          question.topic,
          question.question,
          wasCorrect,
          question.subjectId,
          question.marks,
          {
            conceptsTested: question.conceptsTested,
            userAnswer,
            modelAnswer: question.modelAnswer,
            commandWord: question.commandWord,
            marksAwarded: evaluation.marksAwarded,
            marksPossible: evaluation.totalMarks,
          }
        );

        // 3. Update concept mastery
        if (question.subjectId && question.conceptsTested.length > 0) {
          checkAndUpdateMastery(userId, question.subjectId, question.topic, question.conceptsTested);
        }
      }

      // 4. Award XP
      const xpEarned = wasCorrect
        ? Math.max(15, Math.round(evaluation.percentage * 0.4))
        : Math.max(5, Math.round(evaluation.percentage * 0.15));
      addXp.mutate(xpEarned);
      updateStreak.mutate();

      // 5. Update topic mastery locally
      const topicKey = `${question.subject}::${question.topic}`;
      const topicAnswers = newAnswers.filter(a => `${a.subject}::${a.topic}` === topicKey);
      const recentScores = topicAnswers.map(a => a.evaluation.percentage);
      const accuracy = topicAnswers.filter(a => a.evaluation.percentage >= 50).length / topicAnswers.length;
      const improvementTrend = calculateImprovementTrend(recentScores);
      const consistencyScore = calculateConsistencyScore(recentScores);

      const topicMastery: TopicMastery = {
        topic: question.topic,
        subject: question.subject,
        classification: classifyMastery(accuracy, improvementTrend, consistencyScore, topicAnswers.length),
        accuracy,
        improvementTrend,
        consistencyScore,
        totalAttempts: topicAnswers.length,
        correctAttempts: topicAnswers.filter(a => a.evaluation.percentage >= 50).length,
        conceptsMastered: evaluation.correctConcepts.length,
        conceptsTotal: question.conceptsTested.length || (evaluation.correctConcepts.length + evaluation.missingConcepts.length),
        weakConcepts: evaluation.missingConcepts.concat(evaluation.misconceptions),
        lastAttemptDate: new Date().toISOString(),
        nextReviewDate: null,
        easeFactor: 2.5,
        intervalDays: 1,
      };

      // SM-2 scheduling
      const sm2 = calculateSM2(wasCorrect, topicMastery.easeFactor, topicMastery.intervalDays, topicAnswers.length);
      topicMastery.easeFactor = sm2.newEase;
      topicMastery.intervalDays = sm2.newInterval;
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + sm2.newInterval);
      topicMastery.nextReviewDate = nextReview.toISOString().split('T')[0];

      // 6. Adaptive difficulty adjustment
      let newDifficulty = state.difficulty;
      if (topicAnswers.length >= 3) {
        newDifficulty = recommendDifficulty(topicMastery);
      }

      // 7. Update state with new mastery and answers
      const newMasteries = new Map(state.masteries);
      newMasteries.set(topicKey, topicMastery);

      // 8. Generate insights
      const insights = generateInsightsFromHistory(newAnswers, Array.from(newMasteries.values()));

      // 9. Session stats
      const stats = computeSessionStats(newAnswers, state.sessionStartTime);

      setState(prev => ({
        ...prev,
        answers: newAnswers,
        masteries: newMasteries,
        insights,
        sessionStats: stats,
        isEvaluating: false,
        difficulty: newDifficulty,
      }));

      return evaluation;
    } catch (err) {
      logger.error('[useRecallEngine] Evaluation error:', err);
      setState(prev => ({
        ...prev,
        isEvaluating: false,
        error: err instanceof Error ? err.message : 'Failed to evaluate answer',
      }));
      return null;
    }
  }, [state.questions, state.answers, state.masteries, state.mode, state.difficulty, state.sessionStartTime, userId, recordAttempt, checkAndUpdateMastery, addXp, updateStreak]);

  // ── Navigation ───────────────────────────────────────────────────────────

  const goToNextQuestion = useCallback(() => {
    setState(prev => {
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.questions.length) {
        return { ...prev, isComplete: true };
      }
      return { ...prev, currentIndex: nextIndex };
    });
  }, []);

  const goToPreviousQuestion = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentIndex: Math.max(0, prev.currentIndex - 1),
    }));
  }, []);

  const skipQuestion = useCallback(() => {
    goToNextQuestion();
  }, [goToNextQuestion]);

  // ── Exam Timer ───────────────────────────────────────────────────────────

  const startExamTimer = useCallback(() => {
    if (state.mode !== 'exam' || state.examTimeRemaining === null) return;

    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.examTimeRemaining === null || prev.examTimeRemaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          return { ...prev, examTimeRemaining: 0, isComplete: true };
        }
        return { ...prev, examTimeRemaining: prev.examTimeRemaining - 1 };
      });
    }, 1000);
  }, [state.mode, state.examTimeRemaining]);

  const stopExamTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Complete Session ─────────────────────────────────────────────────────

  const completeSession = useCallback(() => {
    stopExamTimer();
    const stats = computeSessionStats(state.answers, state.sessionStartTime);
    const insights = generateInsightsFromHistory(state.answers, Array.from(state.masteries.values()));
    setState(prev => ({
      ...prev,
      isComplete: true,
      sessionStats: stats,
      insights,
    }));
  }, [state.answers, state.masteries, state.sessionStartTime, stopExamTimer]);

  // ── Reset ────────────────────────────────────────────────────────────────

  const resetSession = useCallback(() => {
    stopExamTimer();
    setState({
      mode,
      questions: [],
      currentIndex: 0,
      answers: [],
      masteries: new Map(),
      insights: [],
      sessionStats: null,
      isGenerating: false,
      isEvaluating: false,
      difficulty: state.difficulty,
      error: null,
      sessionStartTime: Date.now(),
      isComplete: false,
      examTimeRemaining: null,
    });
  }, [mode, state.difficulty, stopExamTimer]);

  // ── Derived State ────────────────────────────────────────────────────────

  const currentQuestion = state.questions[state.currentIndex] || null;
  const progress = state.questions.length > 0
    ? { current: state.currentIndex + 1, total: state.questions.length, percentage: Math.round(((state.currentIndex) / state.questions.length) * 100) }
    : { current: 0, total: 0, percentage: 0 };
  const currentMastery = currentQuestion
    ? state.masteries.get(`${currentQuestion.subject}::${currentQuestion.topic}`) || null
    : null;

  return {
    // State
    ...state,
    currentQuestion,
    progress,
    currentMastery,
    contextLoaded,

    // Actions
    generateQuestions,
    evaluateAnswer,
    goToNextQuestion,
    goToPreviousQuestion,
    skipQuestion,
    startExamTimer,
    stopExamTimer,
    completeSession,
    resetSession,
  };
}
