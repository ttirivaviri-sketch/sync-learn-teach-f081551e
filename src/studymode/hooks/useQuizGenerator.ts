import { useState, useCallback } from 'react';
import { Subject, Topic } from '../types/study';

export interface QuizQuestion {
  id: string;
  question: string;
  marks: number;
  topic: string;
  subject: string;
  modelAnswer?: string;
  keyPoints?: string[];
}

interface UseQuizGeneratorOptions {
  subject: Subject;
  topic?: Topic;
}

// Local AI proxy endpoint
const QUIZ_URL = '/api/ai/generate-quiz';

export function useQuizGenerator({ subject, topic }: UseQuizGeneratorOptions) {
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQuestion = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build topic context
      const topicContext = topic
        ? `Topic: ${topic.name}${topic.subtopics.length > 0 ? `, Subtopics: ${topic.subtopics.join(', ')}` : ''}`
        : `Current topic: ${subject.currentTopic.name}`;

      const resp = await fetch(QUIZ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.name,
          topic: topic?.name || subject.currentTopic.name,
          topicContext,
          examWeight: topic?.examWeight || subject.currentTopic.examWeight,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate question');
      }

      const data = await resp.json();
      setQuestion({
        id: crypto.randomUUID(),
        question: data.question,
        marks: data.marks,
        topic: topic?.name || subject.currentTopic.name,
        subject: subject.name,
        modelAnswer: data.modelAnswer,
        keyPoints: data.keyPoints,
      });
    } catch (err) {
      console.error('Quiz generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate question');
    } finally {
      setIsLoading(false);
    }
  }, [subject, topic]);

  const clearQuestion = useCallback(() => {
    setQuestion(null);
    setError(null);
  }, []);

  return { question, isLoading, error, generateQuestion, clearQuestion };
}
