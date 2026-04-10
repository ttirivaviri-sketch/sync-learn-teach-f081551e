/**
 * useQuizGenerator (v2)
 *
 * Generates exam-style quiz questions that are:
 *   1. Grounded in the student's parsed syllabus (subtopics, learning objectives)
 *   2. Modelled on their uploaded past paper patterns (command words, difficulty, question types)
 *   3. Adapted to the student's current performance (easier if struggling, harder if performing well)
 *   4. Varied — tracks recently used question types to avoid repetition
 *
 * Now supports multiple question types (multiple_choice, short_answer, structured)
 * and returns full solutions, marking schemes, and explanations.
 */

import { useState, useCallback, useRef } from 'react';
import { Subject, Topic } from '../types/study';
import { useSyllabusContext } from './useSyllabusContext';
import { useTopicPerformance } from './useTopicPerformance';
import { aiRequestJSON } from '../lib/aiClient';
import { logger } from "@/utils/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  id: string;
  question: string;
  questionType: 'multiple_choice' | 'short_answer' | 'structured';
  marks: number;
  topic: string;
  subject: string;
  /** For multiple choice */
  options?: string[];
  correctOption?: string;
  /** Complete model answer */
  modelAnswer?: string;
  /** Step-by-step solution */
  stepByStepSolution?: string;
  /** Point-by-point marking scheme */
  markingScheme?: string[];
  keyPoints?: string[];
  /** Difficulty the AI was asked to generate at */
  difficulty?: string;
  /** Command word used (from past paper patterns) */
  commandWord?: string;
  /** Concepts being tested */
  conceptsTested?: string[];
  syllabusLinks?: string[];
  /** Why this answer is correct */
  explanation?: string;
}

interface UseQuizGeneratorOptions {
  subject: Subject;
  topic?: Topic;
}

const QUIZ_ENDPOINT = 'generate-quiz';

export function useQuizGenerator({ subject, topic }: UseQuizGeneratorOptions) {
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track recently generated question types to enforce variety
  const recentQuestionTypes = useRef<string[]>([]);

  // ── Fetch curriculum context ───────────────────────────────────────────────
  const activeTopic = topic || subject.currentTopic;
  const { curriculumContext, examPatterns, examWeightFromPapers, isLoaded: contextLoaded } =
    useSyllabusContext(subject.id, activeTopic?.name);

  // ── Fetch topic performance for adaptive difficulty ────────────────────────
  const { performance } = useTopicPerformance(subject.id, activeTopic?.name);

  // ─────────────────────────────────────────────────────────────────────────

  const generateQuestion = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Determine adaptive difficulty from performance
      const difficulty = performance?.recommendedDifficulty || 'medium';

      // Build topic context string
      const topicData = topic || subject.currentTopic;
      let topicContext = `Topic: ${topicData.name}`;
      if (topicData.subtopics?.length) {
        topicContext += `\nSubtopics: ${topicData.subtopics.join(', ')}`;
      }
      if (topicData.examWeight > 0) {
        topicContext += `\nSyllabus exam weight: ${topicData.examWeight}%`;
      }

      // Add exam pattern hints for question variety
      const topicPatterns = examPatterns.filter(p =>
        p.topic_name?.toLowerCase().includes(topicData.name.toLowerCase()) ||
        topicData.name.toLowerCase().includes(p.topic_name?.toLowerCase() || '')
      );
      const allQTypes = [...new Set(topicPatterns.flatMap(p => p.question_types))];
      
      // Avoid repeating the last question type
      let preferredQType: string | undefined;
      if (allQTypes.length > 1) {
        const available = allQTypes.filter(t => !recentQuestionTypes.current.includes(t));
        preferredQType = available[0] || allQTypes[0];
      }

      // Build performance context for adaptive difficulty
      let performanceContext = '';
      if (performance && performance.totalAttempts > 0) {
        performanceContext = `\nSTUDENT PERFORMANCE DATA:\n`;
        performanceContext += `- Accuracy on this topic: ${Math.round(performance.accuracy * 100)}% (${performance.correctAttempts}/${performance.totalAttempts} correct)\n`;
        performanceContext += `- Mastery status: ${performance.masteryStatus}\n`;
        if (performance.weakConcepts.length > 0) {
          performanceContext += `- Struggling with: ${performance.weakConcepts.join(', ')}\n`;
          performanceContext += `IMPORTANT: Generate a question targeting these weak concepts.\n`;
        }
        if (performance.repeatedMistakes.length > 0) {
          performanceContext += `- Has repeatedly missed questions about: ${performance.repeatedMistakes[0].substring(0, 80)}...\n`;
        }
      }

      const topExamPatterns = topicPatterns
        .slice(0, 4)
        .map((pattern) => `${pattern.question_types?.join('/') || 'mixed'} | avg ${Math.round(pattern.avg_marks || 0)} marks | freq ${Math.round(pattern.frequency_score || 0)}%`)
        .join('; ');

      const pastPaperStyleNotes = topExamPatterns
        ? `Most common past-paper styles for this topic: ${topExamPatterns}`
        : undefined;

      // Build weak areas list
      const weakAreas = performance?.weakConcepts || [];

      const payload = {
        subject: subject.name,
        topic: topicData.name,
        topicContext,
        difficulty,
        preferredQuestionType: preferredQType,
        examWeight: examWeightFromPapers || topicData.examWeight,
        curriculumContext: curriculumContext || undefined,
        performanceContext: performanceContext || undefined,
        pastPaperStyleNotes,
        avoidQuestionTypes: recentQuestionTypes.current.slice(-2),
        weakAreas: weakAreas.length > 0 ? weakAreas : undefined,
        count: 1,
      };

      const data = await aiRequestJSON<any>(QUIZ_ENDPOINT, payload);

      // Handle both v1 (flat) and v2 (quiz array) responses
      let questionData: any;
      if (data.quiz && Array.isArray(data.quiz) && data.quiz.length > 0) {
        questionData = data.quiz[0];
      } else {
        questionData = data;
      }

      // Track question type to enforce variety next time
      const cmdWord = questionData.commandWord || questionData.commandWords?.[0];
      if (cmdWord) {
        recentQuestionTypes.current = [
          ...recentQuestionTypes.current.slice(-3),
          cmdWord,
        ];
      }

      setQuestion({
        id: questionData.id || crypto.randomUUID(),
        question: questionData.question,
        questionType: questionData.questionType || 'structured',
        marks: questionData.marks,
        topic: topicData.name,
        subject: subject.name,
        options: questionData.options,
        correctOption: questionData.correctOption,
        modelAnswer: questionData.modelAnswer,
        stepByStepSolution: questionData.stepByStepSolution,
        markingScheme: questionData.markingScheme,
        keyPoints: questionData.keyPoints,
        difficulty: questionData.difficulty || difficulty,
        commandWord: cmdWord,
        conceptsTested: questionData.conceptsTested,
        syllabusLinks: questionData.syllabusLinks,
        explanation: questionData.explanation,
      });
    } catch (err) {
      logger.error('Quiz generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate question');
    } finally {
      setIsLoading(false);
    }
  }, [subject, topic, curriculumContext, examPatterns, examWeightFromPapers, performance]);

  const clearQuestion = useCallback(() => {
    setQuestion(null);
    setError(null);
  }, []);

  return {
    question,
    isLoading: isLoading || !contextLoaded,
    error,
    generateQuestion,
    clearQuestion,
    /** Exposes context data for debugging / UI hints */
    contextLoaded,
    hasCurriculumData: !!curriculumContext,
    recommendedDifficulty: performance?.recommendedDifficulty || 'medium',
    masteryStatus: performance?.masteryStatus || 'not-started',
    shouldTriggerTopicTest: performance?.shouldTriggerTopicTest || false,
  };
}
