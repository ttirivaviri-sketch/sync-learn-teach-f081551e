/**
 * useSyllabusContext
 *
 * Fetches ALL parsed curriculum data from Supabase for the current subject+topic:
 *   - Full topic details from subjects.topics JSON (subtopics, learningObjectives, concepts)
 *   - Exam patterns from exam_patterns table (frequency, avg_marks, question_types, year)
 *   - Past-paper questions for this topic from documents.parsed_content
 *
 * Returns a rich `CurriculumContext` string that is injected directly into AI prompts,
 * making every generated question/task grounded in the student's actual uploaded materials.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DbTopic {
  id: string;
  name: string;
  subtopics: string[];
  learningObjectives: string[];
  concepts: string[];
  examWeight: number;
  prerequisites: string[];
}

export interface ExamPatternRow {
  topic_name: string;
  frequency_score: number;
  avg_marks: number;
  question_types: string[];
  year: string | null;
}

export interface PastPaperQuestion {
  question_number: string;
  topic: string;
  subtopic?: string;
  marks: number;
  question_type: string;
  difficulty: string;
  command_words: string[];
  concepts_tested: string[];
}

export interface SyllabusContextData {
  /** Full topic data from subjects.topics */
  topic: DbTopic | null;
  /** All topics in this subject (for mastery checking) */
  allTopics: DbTopic[];
  /** Exam pattern rows for this topic from exam_patterns table */
  examPatterns: ExamPatternRow[];
  /** Past paper question samples for this topic */
  pastPaperQuestions: PastPaperQuestion[];
  /** Aggregated exam weight from past papers (%) */
  examWeightFromPapers: number;
  /** How many topics are mastered vs total (for mock exam gating) */
  masteredTopicCount: number;
  totalTopicCount: number;
  /** Percentage of syllabus covered */
  syllabusProgress: number;
  /** Rich context string ready to inject into AI prompts */
  curriculumContext: string;
  /** True once data has been fetched */
  isLoaded: boolean;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function buildCurriculumContext(
  topicName: string,
  topic: DbTopic | null,
  patterns: ExamPatternRow[],
  pastQs: PastPaperQuestion[]
): string {
  const parts: string[] = [];

  // 1. Topic structure from syllabus
  if (topic) {
    parts.push(`=== SYLLABUS DATA FOR: ${topicName} ===`);
    if (topic.subtopics?.length) {
      parts.push(`Subtopics: ${topic.subtopics.join(' | ')}`);
    }
    if (topic.learningObjectives?.length) {
      parts.push(`Learning Objectives:\n${topic.learningObjectives.map(o => `  • ${o}`).join('\n')}`);
    }
    if (topic.concepts?.length) {
      parts.push(`Key Concepts: ${topic.concepts.join(', ')}`);
    }
    if (topic.examWeight > 0) {
      parts.push(`Syllabus Exam Weight: ${topic.examWeight}%`);
    }
  }

  // 2. Exam pattern data (aggregated across past papers)
  const topicPatterns = patterns.filter(p =>
    p.topic_name.toLowerCase().includes(topicName.toLowerCase()) ||
    topicName.toLowerCase().includes(p.topic_name.toLowerCase())
  );

  if (topicPatterns.length > 0) {
    parts.push(`\n=== PAST PAPER EXAM PATTERNS ===`);
    const avgFreq = Math.round(topicPatterns.reduce((a, p) => a + p.frequency_score, 0) / topicPatterns.length);
    const avgMarks = Math.round(topicPatterns.reduce((a, p) => a + p.avg_marks, 0) / topicPatterns.length);
    const allQTypes = [...new Set(topicPatterns.flatMap(p => p.question_types))];
    const years = topicPatterns.map(p => p.year).filter(Boolean);
    
    parts.push(`Exam Frequency: ${avgFreq}% of paper marks allocated to this topic`);
    parts.push(`Average Marks per Paper: ${avgMarks} marks`);
    if (allQTypes.length) parts.push(`Question Types Seen: ${allQTypes.join(', ')}`);
    if (years.length) parts.push(`Papers Analysed: ${years.join(', ')}`);
  }

  // 3. Actual past paper questions (sample up to 5)
  const topicQs = pastQs
    .filter(q =>
      q.topic?.toLowerCase().includes(topicName.toLowerCase()) ||
      topicName.toLowerCase().includes(q.topic?.toLowerCase() || '')
    )
    .slice(0, 5);

  if (topicQs.length > 0) {
    parts.push(`\n=== PAST PAPER QUESTION PATTERNS ===`);
    topicQs.forEach((q, i) => {
      const cw = q.command_words?.join(', ') || 'N/A';
      const ct = q.concepts_tested?.join(', ') || q.subtopic || 'N/A';
      parts.push(
        `Q${i + 1}: [${q.marks} marks, ${q.difficulty}, ${q.question_type}] ` +
        `Command words: ${cw} | Concepts: ${ct}`
      );
    });

    // Summarise command word distribution
    const cmdWords = topicQs.flatMap(q => q.command_words || []);
    const cmdFreq: Record<string, number> = {};
    cmdWords.forEach(w => { cmdFreq[w] = (cmdFreq[w] || 0) + 1; });
    const topCmd = Object.entries(cmdFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);
    if (topCmd.length) {
      parts.push(`Most Frequent Command Words: ${topCmd.join(', ')}`);
    }

    const difficulties = topicQs.map(q => q.difficulty);
    const hardCount = difficulties.filter(d => d === 'hard').length;
    const easyCount = difficulties.filter(d => d === 'easy').length;
    if (hardCount > 0 || easyCount > 0) {
      parts.push(`Difficulty Distribution: ${easyCount} easy, ${difficulties.length - hardCount - easyCount} medium, ${hardCount} hard`);
    }
  }

  return parts.join('\n');
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSyllabusContext(subjectId: string | undefined, topicName: string | undefined) {
  const [data, setData] = useState<SyllabusContextData>({
    topic: null,
    allTopics: [],
    examPatterns: [],
    pastPaperQuestions: [],
    examWeightFromPapers: 0,
    masteredTopicCount: 0,
    totalTopicCount: 0,
    syllabusProgress: 0,
    curriculumContext: '',
    isLoaded: false,
  });

  const refresh = useCallback(async () => {
    if (!subjectId || !topicName) {
      setData(prev => ({ ...prev, isLoaded: true }));
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setData(prev => ({ ...prev, isLoaded: true }));
        return;
      }

      const { data: contextData, error } = await supabase.rpc('get_subject_context', {
        p_subject_id: subjectId,
        p_topic_name: topicName,
      });

      if (error) throw error;

      const payload = (contextData || {}) as Partial<SyllabusContextData>;

      setData({
        topic: (payload.topic as DbTopic | null) || null,
        allTopics: Array.isArray(payload.allTopics) ? (payload.allTopics as DbTopic[]) : [],
        examPatterns: Array.isArray(payload.examPatterns) ? (payload.examPatterns as ExamPatternRow[]) : [],
        pastPaperQuestions: Array.isArray(payload.pastPaperQuestions)
          ? (payload.pastPaperQuestions as PastPaperQuestion[])
          : [],
        examWeightFromPapers: Number(payload.examWeightFromPapers || 0),
        masteredTopicCount: Number(payload.masteredTopicCount || 0),
        totalTopicCount: Number(payload.totalTopicCount || 0),
        syllabusProgress: Number(payload.syllabusProgress || 0),
        curriculumContext: String(payload.curriculumContext || ''),
        isLoaded: true,
      });
    } catch (err) {
      console.error('[useSyllabusContext]', err);
      setData(prev => ({ ...prev, isLoaded: true }));
    }
  }, [subjectId, topicName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...data, refresh };
}
