/**
 * useQuizGenerator
 *
 * Generates exam-style questions that are:
 *   1. Grounded in the student's parsed syllabus (subtopics, learning objectives)
 *   2. Modelled on their uploaded past paper patterns (command words, difficulty, question types)
 *   3. Adapted to the student's current performance (easier if struggling, harder if performing well)
 *   4. Varied — tracks recently used question types to avoid repetition
 */

import { useState, useCallback, useRef } from 'react';
import { Subject, Topic } from '../types/study';
import { useSyllabusContext } from './useSyllabusContext';
import { useTopicPerformance } from './useTopicPerformance';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  id: string;
  question: string;
  marks: number;
  topic: string;
  subject: string;
  modelAnswer?: string;
  keyPoints?: string[];
  /** Difficulty the AI was asked to generate at */
  difficulty?: string;
  /** Command word used (from past paper patterns) */
  commandWord?: string;
  /** Concepts being tested */
  conceptsTested?: string[];
}

interface UseQuizGeneratorOptions {
  subject: Subject;
  topic?: Topic;
}

const QUIZ_URL = '/api/ai/generate-quiz';

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

      const payload = {
        subject: subject.name,
        topic: topicData.name,
        topicContext,
        difficulty,
        preferredQuestionType: preferredQType,
        examWeight: examWeightFromPapers || topicData.examWeight,
        curriculumContext: curriculumContext || undefined,
        performanceContext: performanceContext || undefined,
        avoidQuestionTypes: recentQuestionTypes.current.slice(-2),
      };

      const resp = await fetch(QUIZ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate question');
      }

      const data = await resp.json();

      // Track question type to enforce variety next time
      if (data.commandWords?.[0]) {
        recentQuestionTypes.current = [
          ...recentQuestionTypes.current.slice(-3),
          data.commandWords[0],
        ];
      }

      setQuestion({
        id: crypto.randomUUID(),
        question: data.question,
        marks: data.marks,
        topic: topicData.name,
        subject: subject.name,
        modelAnswer: data.modelAnswer,
        keyPoints: data.keyPoints,
        difficulty: data.difficulty || difficulty,
        commandWord: data.commandWords?.[0],
        conceptsTested: data.conceptsTested,
      });
    } catch (err) {
      console.error('Quiz generation error:', err);
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
