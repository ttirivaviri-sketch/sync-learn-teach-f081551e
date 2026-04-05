/**
 * useTaskContent
 *
 * Generates study task content that is grounded in the student's actual:
 *   - Parsed syllabus (subtopics, learning objectives, concepts)
 *   - Past paper patterns (exam weight, command words, question types)
 *   - Topic performance (mastery level, weak areas)
 *
 * Streams the response for a live typing effect.
 * Handles multiple response formats: SSE, raw text, and JSON.
 */

import { useState, useCallback, useRef } from 'react';
import { aiRequest } from '../lib/aiClient';
import type { AIContextPayload } from './useAIStudyIntelligence';

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
  /** AI intelligence context for enrichment */
  aiContext?: AIContextPayload | null;
}

interface UseTaskContentReturn {
  content: string;
  isLoading: boolean;
  error: string | null;
  generateContent: (params: TaskContentParams) => Promise<void>;
  reset: () => void;
  /** Inject AI intelligence context for all subsequent generations */
  setAIContext: (ctx: AIContextPayload | null) => void;
}

const TASK_CONTENT_ENDPOINT = 'generate-task-content';

/**
 * Try to extract text content from an SSE data line.
 * Handles: OpenAI SSE format, plain text, and various JSON shapes.
 */
function extractDeltaContent(jsonStr: string): string | null {
  try {
    const parsed = JSON.parse(jsonStr);
    // OpenAI SSE format: { choices: [{ delta: { content: "..." } }] }
    const delta = parsed.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') return delta;

    // Alternative: { choices: [{ message: { content: "..." } }] }
    const msg = parsed.choices?.[0]?.message?.content;
    if (typeof msg === 'string') return msg;

    // Alternative: { content: "..." }
    if (typeof parsed.content === 'string') return parsed.content;

    // Alternative: { text: "..." }
    if (typeof parsed.text === 'string') return parsed.text;

    return null;
  } catch {
    return null;
  }
}

export function useTaskContent(): UseTaskContentReturn {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aiContextRef = useRef<AIContextPayload | null>(null);

  const setAIContext = useCallback((ctx: AIContextPayload | null) => {
    aiContextRef.current = ctx;
  }, []);

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
      // Merge AI intelligence context into the request
      const aiCtx = params.aiContext || aiContextRef.current;
      const enrichedParams = {
        ...params,
        // Layer on curriculum and performance context from AI Intelligence Engine
        curriculumContext: aiCtx?.curriculumContext
          ? `${aiCtx.curriculumContext}\n\n${params.curriculumContext || ''}`
          : params.curriculumContext,
        performanceContext: aiCtx?.performanceContext
          ? `${aiCtx.performanceContext}\n\n${params.performanceContext || ''}`
          : params.performanceContext,
        // Add enriched data
        syllabusData: aiCtx?.syllabusData || '',
        pastPaperData: aiCtx?.pastPaperData || '',
        examBoardContext: aiCtx?.examBoardContext || '',
        weakAreas: aiCtx?.weakAreas || [],
        studyRecommendations: aiCtx?.studyRecommendations || '',
        difficultyLevel: aiCtx?.difficultyLevel || params.difficulty || 'medium',
        timeContext: aiCtx?.timeContext || '',
        notesContext: aiCtx?.notesContext || '',
        // Enable internet access for AI enrichment
        internetAccess: true,
        internetInstruction:
          `Use internet access to enrich this ${params.taskType} task for ${params.subject} > ${params.topic}. ` +
          'Look up the latest syllabus specifications, exam patterns, and learning resources. ' +
          'Incorporate real-world examples and up-to-date content relevant to the student\'s curriculum.',
      };
      // Remove the nested aiContext to avoid circular reference
      delete (enrichedParams as any).aiContext;

      const resp = await aiRequest(TASK_CONTENT_ENDPOINT, enrichedParams);

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: `Failed to generate content (HTTP ${resp.status})` }));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      if (!resp.body) {
        // No streaming body — try to read as text/JSON
        const text = await resp.text();
        if (text) {
          setContent(text);
        } else {
          throw new Error('No response body received');
        }
        return;
      }

      const contentType = resp.headers.get('content-type') || '';
      const isSSE = contentType.includes('text/event-stream');
      const isJSON = contentType.includes('application/json');

      // If JSON response (non-streaming), extract content directly
      if (isJSON) {
        const data = await resp.json();
        const text = data.content || data.text || data.message || JSON.stringify(data);
        setContent(text);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        if (isSSE) {
          // Parse SSE format: lines starting with "data: "
          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;

            const delta = extractDeltaContent(jsonStr);
            if (delta) {
              accumulated += delta;
              setContent(accumulated);
            }
          }
        } else {
          // Non-SSE streaming: could be raw text or chunked SSE without proper content-type
          // Try to parse as SSE first, then fall back to raw text
          let processed = false;
          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.trim() === '' || line.startsWith(':')) continue;

            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              const delta = extractDeltaContent(jsonStr);
              if (delta) {
                accumulated += delta;
                setContent(accumulated);
                processed = true;
              }
            } else {
              // Raw text chunk — might be plain markdown content
              accumulated += line + '\n';
              setContent(accumulated);
              processed = true;
            }
          }

          // If no newlines yet and buffer is getting long, it's probably raw text
          if (!processed && buffer.length > 200) {
            accumulated += buffer;
            buffer = '';
            setContent(accumulated);
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        if (isSSE || buffer.includes('data: ')) {
          for (const raw of buffer.split('\n')) {
            if (!raw || !raw.startsWith('data: ')) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            const delta = extractDeltaContent(jsonStr);
            if (delta) {
              accumulated += delta;
              setContent(accumulated);
            }
          }
        } else {
          accumulated += buffer;
          setContent(accumulated);
        }
      }

      // If we accumulated nothing, something went wrong
      if (!accumulated.trim()) {
        throw new Error('AI returned empty content. Please try again.');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      console.error('[useTaskContent] Error:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { content, isLoading, error, generateContent, reset, setAIContext };
}
