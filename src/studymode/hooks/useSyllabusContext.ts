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
 *
 * Falls back gracefully: if the RPC doesn't exist or fails, it fetches data directly
 * from the subjects table as a simpler alternative.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { logger } from "@/utils/logger";

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
      parts.push(`Learning Objectives:\n${topic.learningObjectives.map(o => `  - ${o}`).join('\n')}`);
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
    p.topic_name?.toLowerCase().includes(topicName.toLowerCase()) ||
    topicName.toLowerCase().includes(p.topic_name?.toLowerCase() || '')
  );

  if (topicPatterns.length > 0) {
    parts.push(`\n=== PAST PAPER EXAM PATTERNS ===`);
    const avgFreq = Math.round(topicPatterns.reduce((a, p) => a + (p.frequency_score || 0), 0) / topicPatterns.length);
    const avgMarks = Math.round(topicPatterns.reduce((a, p) => a + (p.avg_marks || 0), 0) / topicPatterns.length);
    const allQTypes = [...new Set(topicPatterns.flatMap(p => p.question_types || []))];
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
  }

  return parts.join('\n');
}

/**
 * Direct fallback: fetch subject data from the subjects table
 * when the RPC is unavailable.
 */
async function fetchSubjectDataDirect(
  subjectId: string,
  topicName: string,
  userId: string
): Promise<SyllabusContextData> {
  const result: SyllabusContextData = {
    topic: null,
    allTopics: [],
    examPatterns: [],
    pastPaperQuestions: [],
    examWeightFromPapers: 0,
    masteredTopicCount: 0,
    totalTopicCount: 0,
    syllabusProgress: 0,
    curriculumContext: '',
    isLoaded: true,
  };

  try {
    // Fetch subject with topics
    const { data: subjectData } = await supabase
      .from('subjects')
      .select('name, topics')
      .eq('id', subjectId)
      .eq('user_id', userId)
      .single();

    if (!subjectData) return result;

    const allTopics = Array.isArray(subjectData.topics)
      ? (subjectData.topics as unknown as DbTopic[])
      : [];
    result.allTopics = allTopics;
    result.totalTopicCount = allTopics.length;

    // Find matching topic
    const matchedTopic = allTopics.find(
      t => t.name?.toLowerCase() === topicName?.toLowerCase()
    ) || allTopics.find(
      t => t.name?.toLowerCase().includes(topicName?.toLowerCase()) ||
           topicName?.toLowerCase().includes(t.name?.toLowerCase())
    ) || null;
    result.topic = matchedTopic;

    if (matchedTopic) {
      result.examWeightFromPapers = matchedTopic.examWeight || 0;
    }

    // Fetch exam patterns (best effort)
    try {
      const { data: patterns } = await supabase
        .from('exam_patterns')
        .select('topic_name, frequency_score, avg_marks, question_types, year')
        .eq('subject_id', subjectId)
        .eq('user_id', userId);

      if (patterns) {
        result.examPatterns = patterns as ExamPatternRow[];
      }
    } catch {
      // exam_patterns table might not exist yet
    }

    // Fetch mastery count
    try {
      const { data: masteryData } = await supabase
        .from('topic_mastery')
        .select('mastery_percentage')
        .eq('subject_id', subjectId)
        .eq('user_id', userId);

      if (masteryData) {
        result.masteredTopicCount = masteryData.filter(
          m => (m.mastery_percentage || 0) >= 70
        ).length;
        if (result.totalTopicCount > 0) {
          result.syllabusProgress = Math.round(
            (result.masteredTopicCount / result.totalTopicCount) * 100
          );
        }
      }
    } catch {
      // topic_mastery table might not exist yet
    }

    // Build context string
    result.curriculumContext = buildCurriculumContext(
      topicName,
      result.topic,
      result.examPatterns,
      result.pastPaperQuestions
    );
  } catch (err) {
    logger.warn('[useSyllabusContext] Direct fetch error:', err);
  }

  return result;
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

      // Try the RPC first
      let rpcSuccess = false;
      try {
        const { data: contextData, error } = await supabase.rpc('get_subject_context', {
          p_subject_id: subjectId,
          p_topic_name: topicName,
        });

        if (!error && contextData && !(contextData as any).error) {
          const payload = contextData as Record<string, unknown>;

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
          rpcSuccess = true;
        }
      } catch (rpcErr) {
        logger.warn('[useSyllabusContext] RPC unavailable, using direct fallback:', rpcErr);
      }

      // Fallback: fetch data directly from tables
      if (!rpcSuccess) {
        const directData = await fetchSubjectDataDirect(subjectId, topicName, user.id);
        setData(directData);
      }
    } catch (err) {
      logger.error('[useSyllabusContext]', err);
      setData(prev => ({ ...prev, isLoaded: true }));
    }
  }, [subjectId, topicName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...data, refresh };
}

/**
 * Enhanced version that merges with AI Study Intelligence context.
 * Use this when AIContextPayload is available for richer curriculum context.
 */
export function buildEnhancedCurriculumContext(
  baseContext: string,
  aiContext?: {
    curriculumContext?: string;
    examBoardContext?: string;
    studyRecommendations?: string;
    difficultyLevel?: string;
    timeContext?: string;
  } | null
): string {
  if (!aiContext) return baseContext;

  const parts = [baseContext];

  if (aiContext.curriculumContext) {
    parts.push('\n' + aiContext.curriculumContext);
  }
  if (aiContext.examBoardContext) {
    parts.push('\n=== EXAM BOARD CONTEXT (INTERNET ACCESS) ===\n' + aiContext.examBoardContext);
  }
  if (aiContext.studyRecommendations) {
    parts.push('\n' + aiContext.studyRecommendations);
  }
  if (aiContext.timeContext) {
    parts.push('\n=== TIME CONTEXT ===\n' + aiContext.timeContext);
  }
  if (aiContext.difficultyLevel) {
    parts.push(`\nTarget Difficulty: ${aiContext.difficultyLevel}`);
  }

  return parts.filter(Boolean).join('\n');
}
