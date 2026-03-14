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
      if (!user) return;

      // 1. Fetch subject row for topics JSON + exam_patterns aggregate
      const { data: subjectRow } = await supabase
        .from('subjects')
        .select('topics, exam_patterns')
        .eq('id', subjectId)
        .single();

      const allTopics: DbTopic[] = (Array.isArray(subjectRow?.topics) ? subjectRow!.topics : []) as DbTopic[];
      const topic = allTopics.find(t =>
        t.name?.toLowerCase() === topicName.toLowerCase() ||
        t.name?.toLowerCase().includes(topicName.toLowerCase())
      ) || null;

      // 2. Fetch exam patterns from exam_patterns table
      const { data: patternRows } = await supabase
        .from('exam_patterns')
        .select('topic_name, frequency_score, avg_marks, question_types, year')
        .eq('subject_id', subjectId)
        .eq('user_id', user.id);

      const examPatterns: ExamPatternRow[] = (patternRows || []).map(r => ({
        topic_name: r.topic_name,
        frequency_score: Number(r.frequency_score) || 0,
        avg_marks: Number(r.avg_marks) || 0,
        question_types: Array.isArray(r.question_types) ? r.question_types : [],
        year: r.year || null,
      }));

      // 3. Fetch ALL processed documents for this subject/user (both past papers AND syllabus)
      const { data: docs } = await supabase
        .from('documents')
        .select('parsed_content, document_type, subject_id')
        .eq('user_id', user.id)
        .eq('is_processed', true)
        .in('document_type', ['past_paper', 'syllabus']);

      const pastPaperQuestions: PastPaperQuestion[] = [];

      // Also extract syllabus-level topic data from syllabus documents
      let syllabusTopicData: DbTopic | null = null;

      (docs || []).forEach(doc => {
        if (!doc.parsed_content) return;
        const parsed = doc.parsed_content as Record<string, unknown>;

        if (doc.document_type === 'past_paper') {
          // Extract question patterns from past papers
          const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
          questions.forEach((q: Record<string, unknown>) => {
            if (q.topic) {
              pastPaperQuestions.push({
                question_number: String(q.question_number || ''),
                topic: String(q.topic || ''),
                subtopic: q.subtopic ? String(q.subtopic) : undefined,
                marks: Number(q.marks) || 1,
                question_type: String(q.question_type || 'structured'),
                difficulty: String(q.difficulty || 'medium'),
                command_words: Array.isArray(q.command_words) ? q.command_words : [],
                concepts_tested: Array.isArray(q.concepts_tested) ? q.concepts_tested : [],
              });
            }
          });
        } else if (doc.document_type === 'syllabus') {
          // Extract topic-level data from syllabus documents
          const syllabusTopics = Array.isArray(parsed.topics) ? parsed.topics : [];
          const matchedTopic = syllabusTopics.find((t: Record<string, unknown>) =>
            String(t.name || '').toLowerCase().includes(topicName!.toLowerCase()) ||
            topicName!.toLowerCase().includes(String(t.name || '').toLowerCase())
          );
          if (matchedTopic && !syllabusTopicData) {
            // Merge parsed syllabus data with the Supabase topic row
            syllabusTopicData = {
              id: String(matchedTopic.id || ''),
              name: String(matchedTopic.name || topicName),
              subtopics: Array.isArray(matchedTopic.subtopics)
                ? matchedTopic.subtopics.map(String)
                : [],
              learningObjectives: Array.isArray(matchedTopic.learningObjectives)
                ? matchedTopic.learningObjectives.map(String)
                : (Array.isArray(matchedTopic.learning_objectives)
                    ? (matchedTopic.learning_objectives as unknown[]).map(String)
                    : []),
              concepts: Array.isArray(matchedTopic.concepts)
                ? matchedTopic.concepts.map(String)
                : (Array.isArray(matchedTopic.key_concepts)
                    ? (matchedTopic.key_concepts as unknown[]).map(String)
                    : []),
              examWeight: Number(matchedTopic.examWeight || matchedTopic.exam_weight || 0),
              prerequisites: Array.isArray(matchedTopic.prerequisites)
                ? matchedTopic.prerequisites.map(String)
                : [],
            } as DbTopic;
          }
        }
      });

      // 4. Fetch topic mastery to calculate syllabus progress
      const { data: masteryRows } = await supabase
        .from('topic_mastery')
        .select('topic_name, mastery_percentage')
        .eq('subject_id', subjectId)
        .eq('user_id', user.id);

      const masteredTopicCount = (masteryRows || []).filter(m => (m.mastery_percentage || 0) >= 70).length;
      const totalTopicCount = allTopics.length;
      const syllabusProgress = totalTopicCount > 0
        ? Math.round((masteredTopicCount / totalTopicCount) * 100)
        : 0;

      // 5. Get exam weight from past paper patterns for this specific topic
      const topicPats = examPatterns.filter(p =>
        p.topic_name?.toLowerCase().includes(topicName.toLowerCase()) ||
        topicName.toLowerCase().includes(p.topic_name?.toLowerCase() || '')
      );
      const examWeightFromPapers = topicPats.length > 0
        ? Math.round(topicPats.reduce((a, p) => a + p.frequency_score, 0) / topicPats.length)
        : topic?.examWeight || 0;

      // 6. Merge syllabus document data into topic (syllabus doc data takes precedence for subtopics/objectives)
      const mergedTopic: DbTopic | null = topic ? {
        ...topic,
        // If syllabus doc has more detailed subtopics/objectives, use them
        subtopics: syllabusTopicData?.subtopics?.length
          ? syllabusTopicData.subtopics
          : (topic.subtopics || []),
        learningObjectives: syllabusTopicData?.learningObjectives?.length
          ? syllabusTopicData.learningObjectives
          : (topic.learningObjectives || []),
        concepts: syllabusTopicData?.concepts?.length
          ? syllabusTopicData.concepts
          : (topic.concepts || []),
      } : syllabusTopicData;

      // 7. Build curriculum context string using merged topic data
      const curriculumContext = buildCurriculumContext(topicName, mergedTopic, examPatterns, pastPaperQuestions);

      setData({
        topic: mergedTopic,
        allTopics,
        examPatterns,
        pastPaperQuestions,
        examWeightFromPapers,
        masteredTopicCount,
        totalTopicCount,
        syllabusProgress,
        curriculumContext,
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
