/**
 * useTaskContent
 *
 * Generates study task content that is grounded in the student's actual:
 *   - Parsed syllabus (subtopics, learning objectives, concepts)
 *   - Past paper patterns (exam weight, command words, question types)
 *   - Topic performance (mastery level, weak areas)
 *
 * Streams the response as SSE chunks for a live typing effect.
 */

import { useState, useCallback } from 'react';

export interface TaskContentParams {
  taskType: string;
  subject: string;
  subjectId?: string;
  topic: string;
  subtopics?: string[];
  learningObjectives?: string[];
  concepts?: string[];
  examWeight?: number;
  /** Rich curriculum context string from useSyllabusContext */
  curriculumContext?: string;
  /** Student performance context for adaptive content */
  performanceContext?: string;
  /** Mastery level affects depth of content */
  masteryStatus?: 'mastered' | 'needs-practice' | 'not-started';
  /** Difficulty level for exam questions within tasks */
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface UseTaskContentReturn {
  content: string;
  isLoading: boolean;
  error: string | null;
  generateContent: (params: TaskContentParams) => Promise<void>;
  reset: () => void;
}

const TASK_CONTENT_URL = '/api/ai/generate-task-content';

export function useTaskContent(): UseTaskContentReturn {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setContent('');
    setError(null);
    setIsLoading(false);
  }, []);

  const generateContent = useCallback(async (params: TaskContentParams) => {
    setIsLoading(true);
    setContent('');
    setError(null);

    try {
      const resp = await fetch(TASK_CONTENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: 'Failed to generate content' }));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setContent(accumulated);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw || !raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setContent(accumulated);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { content, isLoading, error, generateContent, reset };
}
