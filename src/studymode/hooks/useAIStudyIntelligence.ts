/**
 * useAIStudyIntelligence.ts
 *
 * The AI Study Intelligence Engine for StudySync.
 *
 * This is the brain of the system — it combines:
 *  1. Academic profile (curriculum, grade, subjects, exam year)
 *  2. Syllabus codes & paper codes from SyllabusSetupGate
 *  3. Uploaded & parsed documents (syllabi, past papers, notes)
 *  4. Student performance data (quiz accuracy, weak topics, mastery)
 *  5. Internet-fetched syllabus enrichment data (latest syllabus specs, exam updates)
 *
 * The engine:
 *  - Enriches daily tasks with curriculum-specific context
 *  - Adapts difficulty based on student pace and understanding level
 *  - Tracks learning patterns over time and adjusts recommendations
 *  - Provides a comprehensive AI context payload for all AI calls
 *  - Uses internet access to fetch the latest exam board updates
 *
 * This makes the AI the most formidable study assistant possible,
 * tailored to each student's unique pace and level of understanding.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { aiRequestJSON } from '../lib/aiClient';
import type { AcademicProfile } from '@/types/academicProfile';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyllabusIntelligence {
  /** Curriculum-specific context (e.g., "ZIMSEC O Level Mathematics 4028") */
  curriculumIdentifier: string;
  /** Syllabus codes mapped to subjects */
  syllabusCodeMap: Record<string, string>;
  /** Paper codes mapped to subjects */
  paperCodeMap: Record<string, string[]>;
  /** Enriched topic data from internet + parsed docs */
  enrichedTopics: EnrichedTopic[];
  /** Internet-sourced exam board updates and changes */
  examBoardUpdates: string;
  /** Latest past paper patterns and trends */
  examTrends: string;
}

export interface EnrichedTopic {
  subject: string;
  topic: string;
  syllabusCode: string;
  paperCodes: string[];
  /** Detailed learning objectives from official syllabus */
  learningObjectives: string[];
  /** Key concepts that examiners look for */
  examinerFocusPoints: string[];
  /** Common student mistakes from past papers */
  commonMistakes: string[];
  /** Recommended study approach based on topic type */
  studyApproach: string;
  /** Exam weight / frequency from past papers */
  examWeight: number;
  /** Command words frequently used for this topic */
  commandWords: string[];
}

export interface StudentLearningProfile {
  /** Overall understanding level (0-100) */
  overallUnderstanding: number;
  /** Per-subject understanding levels */
  subjectUnderstanding: Record<string, number>;
  /** Current learning pace (slow | moderate | fast) */
  learningPace: 'slow' | 'moderate' | 'fast';
  /** Topics the student struggles with most */
  persistentWeakAreas: string[];
  /** Topics the student excels at */
  strengths: string[];
  /** Learning style inference */
  inferredLearningStyle: string;
  /** Time spent per topic (trend data) */
  timePerTopicTrend: Record<string, number>;
  /** Accuracy trend over last 30 days */
  accuracyTrend: number[];
  /** Recommended difficulty level for next tasks */
  recommendedDifficulty: 'easy' | 'medium' | 'hard' | 'exam-level';
  /** Days until exam (for urgency calibration) */
  daysUntilExam: number | null;
  /** Revision priority queue */
  revisionPriority: { topic: string; subject: string; urgency: number; reason: string }[];
}

export interface AIContextPayload {
  /** Full curriculum identifier string */
  curriculumContext: string;
  /** Student's current performance and learning profile */
  performanceContext: string;
  /** Parsed syllabus data (topics, objectives, concepts) */
  syllabusData: string;
  /** Past paper patterns and question analysis */
  pastPaperData: string;
  /** Internet-enriched exam board updates */
  examBoardContext: string;
  /** Student's weak areas for prioritisation */
  weakAreas: string[];
  /** Student-specific study recommendations */
  studyRecommendations: string;
  /** Difficulty calibration for this student */
  difficultyLevel: string;
  /** Time pressure context (days until exam) */
  timeContext: string;
  /** Document-derived notes and key concepts */
  notesContext: string;
}

export interface AIStudyIntelligenceState {
  isLoading: boolean;
  isEnriching: boolean;
  lastEnriched: Date | null;
  syllabusIntelligence: SyllabusIntelligence | null;
  learningProfile: StudentLearningProfile | null;
  error: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ENRICHMENT_COOLDOWN_HOURS = 24; // Re-enrich syllabus data daily
const LEARNING_PROFILE_CACHE_KEY = 'studysync_learning_profile';
const ENRICHMENT_CACHE_KEY = 'studysync_syllabus_enrichment';

// ─── Curriculum identifier builder ───────────────────────────────────────────

function buildCurriculumIdentifier(profile: AcademicProfile | null): string {
  if (!profile) return '';
  const parts = [];
  if (profile.curriculum) parts.push(profile.curriculum);
  if (profile.grade) parts.push(profile.grade);
  if (profile.exam_board) parts.push(profile.exam_board);
  if (profile.exam_year) parts.push(`Exam ${profile.exam_year}`);
  return parts.join(' | ');
}

// ─── Exam board URL/keyword mappings for internet search context ─────────────

const EXAM_BOARD_SEARCH_CONTEXT: Record<string, string> = {
  ZIMSEC: 'ZIMSEC Zimbabwe School Examinations Council syllabus latest updates specimen papers',
  CAMB: 'Cambridge CAIE CIE IGCSE A-Level syllabus latest updates specimen papers',
  IGCSE: 'Cambridge IGCSE syllabus latest updates past papers mark schemes',
  IEB: 'IEB South Africa Independent Examinations Board NSC syllabus updates',
  NSC: 'South Africa NSC CAPS curriculum latest past papers memo',
  OTHER: 'exam board syllabus latest updates past papers',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAIStudyIntelligence(academicProfile?: AcademicProfile | null) {
  const [state, setState] = useState<AIStudyIntelligenceState>({
    isLoading: false,
    isEnriching: false,
    lastEnriched: null,
    syllabusIntelligence: null,
    learningProfile: null,
    error: null,
  });

  const enrichmentRef = useRef(false);
  const profileRef = useRef<AcademicProfile | null>(null);

  // ── Load cached data on mount ─────────────────────────────────────────────
  useEffect(() => {
    try {
      const cachedProfile = localStorage.getItem(LEARNING_PROFILE_CACHE_KEY);
      const cachedEnrichment = localStorage.getItem(ENRICHMENT_CACHE_KEY);

      if (cachedProfile) {
        const parsed = JSON.parse(cachedProfile);
        setState(prev => ({ ...prev, learningProfile: parsed }));
      }
      if (cachedEnrichment) {
        const parsed = JSON.parse(cachedEnrichment);
        setState(prev => ({
          ...prev,
          syllabusIntelligence: parsed.intelligence,
          lastEnriched: parsed.timestamp ? new Date(parsed.timestamp) : null,
        }));
      }
    } catch {
      // Cache corrupt — ignore
    }
  }, []);

  // ── Build complete syllabus intelligence from all sources ─────────────────
  const buildSyllabusIntelligence = useCallback(async (): Promise<SyllabusIntelligence | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const profile = academicProfile || profileRef.current;
    if (!profile) return null;

    // 1. Fetch subjects with syllabus codes and topics
    const { data: subjectsData } = await supabase
      .from('subjects')
      .select('id, name, syllabus_code, topics')
      .eq('user_id', user.id);

    const subjects = (subjectsData || []) as any[];

    // 2. Build syllabus & paper code maps
    const syllabusCodeMap: Record<string, string> = {};
    const paperCodeMap: Record<string, string[]> = {};
    const enrichedTopics: EnrichedTopic[] = [];

    for (const subj of subjects) {
      if (subj.syllabus_code) {
        syllabusCodeMap[subj.name] = subj.syllabus_code;
      }
      const topics = Array.isArray(subj.topics) ? subj.topics : [];
      const paperCodes: string[] = [];

      for (const topic of topics) {
        if (topic.paper_code && !paperCodes.includes(topic.paper_code)) {
          paperCodes.push(topic.paper_code);
        }

        enrichedTopics.push({
          subject: subj.name,
          topic: topic.name || 'Unknown',
          syllabusCode: subj.syllabus_code || '',
          paperCodes: topic.paper_code ? [topic.paper_code] : [],
          learningObjectives: topic.learningObjectives || [],
          examinerFocusPoints: topic.concepts || [],
          commonMistakes: [],
          studyApproach: '',
          examWeight: topic.examWeight || 0,
          commandWords: [],
        });
      }
      paperCodeMap[subj.name] = paperCodes;
    }

    // 3. Fetch parsed document data for enrichment
    const { data: docsData } = await supabase
      .from('documents')
      .select('type, subject, parsed_content, is_processed')
      .eq('user_id', user.id)
      .eq('is_processed', true);

    const docs = (docsData || []) as any[];

    // Enrich topics from past paper analysis
    for (const doc of docs) {
      if (doc.type === 'past_paper' && doc.parsed_content?.questions) {
        const questions = doc.parsed_content.questions as any[];
        for (const q of questions) {
          const matchingTopic = enrichedTopics.find(
            et => et.subject.toLowerCase() === doc.subject?.toLowerCase() &&
            (et.topic.toLowerCase().includes(q.topic?.toLowerCase() || '') ||
             q.topic?.toLowerCase().includes(et.topic.toLowerCase()))
          );
          if (matchingTopic) {
            if (q.command_words) {
              matchingTopic.commandWords = [
                ...new Set([...matchingTopic.commandWords, ...q.command_words]),
              ];
            }
            if (q.concepts_tested) {
              matchingTopic.examinerFocusPoints = [
                ...new Set([...matchingTopic.examinerFocusPoints, ...q.concepts_tested]),
              ];
            }
          }
        }
      }
    }

    // 4. Build exam board search context for AI internet enrichment
    const curriculum = profile.curriculum || 'OTHER';
    const searchContext = EXAM_BOARD_SEARCH_CONTEXT[curriculum] || EXAM_BOARD_SEARCH_CONTEXT.OTHER;
    const subjectList = subjects.map(s =>
      `${s.name}${s.syllabus_code ? ` (${s.syllabus_code})` : ''}`
    ).join(', ');

    const examBoardUpdates =
      `Exam Board: ${curriculum}\n` +
      `Search Context: ${searchContext}\n` +
      `Registered Subjects: ${subjectList}\n` +
      `Exam Year: ${profile.exam_year || 'Current year'}\n` +
      `Grade: ${profile.grade || 'Not specified'}\n` +
      `INSTRUCTION: Use internet access to look up the latest syllabus specifications, ` +
      `exam board announcements, specimen papers, and examiner reports for these subjects. ` +
      `Incorporate any recent changes to topic weighting, command word emphasis, or paper format.`;

    // 5. Build exam trends from parsed past papers
    const examTrendParts: string[] = [];
    const { data: examPatterns } = await supabase
      .from('exam_patterns')
      .select('topic_name, frequency_score, avg_marks, question_types, year')
      .eq('user_id', user.id);

    if (examPatterns && examPatterns.length > 0) {
      examTrendParts.push('=== PAST PAPER TRENDS ===');
      const byTopic: Record<string, any[]> = {};
      for (const ep of examPatterns as any[]) {
        const key = ep.topic_name || 'General';
        if (!byTopic[key]) byTopic[key] = [];
        byTopic[key].push(ep);
      }
      for (const [topic, patterns] of Object.entries(byTopic)) {
        const avgFreq = Math.round(
          patterns.reduce((a, p) => a + (p.frequency_score || 0), 0) / patterns.length
        );
        const avgMarks = Math.round(
          patterns.reduce((a, p) => a + (p.avg_marks || 0), 0) / patterns.length
        );
        const qTypes = [...new Set(patterns.flatMap(p => p.question_types || []))];
        examTrendParts.push(
          `${topic}: freq=${avgFreq}%, avg_marks=${avgMarks}, types=[${qTypes.join(', ')}]`
        );
      }
    }

    return {
      curriculumIdentifier: buildCurriculumIdentifier(profile),
      syllabusCodeMap,
      paperCodeMap,
      enrichedTopics,
      examBoardUpdates,
      examTrends: examTrendParts.join('\n'),
    };
  }, [academicProfile]);

  // ── Build student learning profile from performance data ────────────────
  const buildLearningProfile = useCallback(async (): Promise<StudentLearningProfile | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 1. Fetch quiz attempts (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const { data: attempts } = await supabase
      .from('quiz_attempts' as any)
      .select('topic_name, subject_id, was_correct, difficulty_rating, created_at')
      .eq('user_id', user.id)
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: true });

    // 2. Fetch subjects for mapping
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('user_id', user.id);

    const subjectMap = new Map((subjects || []).map((s: any) => [s.id, s.name]));

    // 3. Calculate per-subject understanding
    const subjectAccuracy: Record<string, { correct: number; total: number }> = {};
    const topicAccuracy: Record<string, { correct: number; total: number; lastAttempt: string }> = {};
    const dailyAccuracy: Record<string, { correct: number; total: number }> = {};

    for (const a of (attempts || []) as any[]) {
      const subjName = subjectMap.get(a.subject_id) || 'Unknown';
      if (!subjectAccuracy[subjName]) subjectAccuracy[subjName] = { correct: 0, total: 0 };
      subjectAccuracy[subjName].total++;
      if (a.was_correct) subjectAccuracy[subjName].correct++;

      const topic = a.topic_name || 'Unknown';
      if (!topicAccuracy[topic]) topicAccuracy[topic] = { correct: 0, total: 0, lastAttempt: '' };
      topicAccuracy[topic].total++;
      if (a.was_correct) topicAccuracy[topic].correct++;
      topicAccuracy[topic].lastAttempt = a.created_at;

      const day = a.created_at?.split('T')[0] || 'unknown';
      if (!dailyAccuracy[day]) dailyAccuracy[day] = { correct: 0, total: 0 };
      dailyAccuracy[day].total++;
      if (a.was_correct) dailyAccuracy[day].correct++;
    }

    // 4. Calculate understanding levels
    const subjectUnderstanding: Record<string, number> = {};
    for (const [name, acc] of Object.entries(subjectAccuracy)) {
      subjectUnderstanding[name] = acc.total > 0 ? Math.round((acc.correct / acc.total) * 100) : 0;
    }

    const totalCorrect = Object.values(subjectAccuracy).reduce((a, v) => a + v.correct, 0);
    const totalAttempts = Object.values(subjectAccuracy).reduce((a, v) => a + v.total, 0);
    const overallUnderstanding = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 50;

    // 5. Determine learning pace from daily attempt frequency
    const days = Object.keys(dailyAccuracy).sort();
    const recentDays = days.slice(-14); // Last 2 weeks
    const avgDailyAttempts = recentDays.length > 0
      ? recentDays.reduce((a, d) => a + (dailyAccuracy[d]?.total || 0), 0) / recentDays.length
      : 0;

    let learningPace: 'slow' | 'moderate' | 'fast' = 'moderate';
    if (avgDailyAttempts < 3) learningPace = 'slow';
    else if (avgDailyAttempts > 10) learningPace = 'fast';

    // 6. Identify persistent weak areas (low accuracy, many attempts)
    const persistentWeakAreas = Object.entries(topicAccuracy)
      .filter(([, v]) => v.total >= 3 && v.correct / v.total < 0.5)
      .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
      .map(([topic]) => topic)
      .slice(0, 10);

    // 7. Identify strengths
    const strengths = Object.entries(topicAccuracy)
      .filter(([, v]) => v.total >= 3 && v.correct / v.total >= 0.85)
      .map(([topic]) => topic)
      .slice(0, 5);

    // 8. Build accuracy trend (last 30 days)
    const last30 = days.slice(-30);
    const accuracyTrend = last30.map(d => {
      const acc = dailyAccuracy[d];
      return acc && acc.total > 0 ? Math.round((acc.correct / acc.total) * 100) : 0;
    });

    // 9. Infer learning style from attempt patterns
    let inferredLearningStyle = 'balanced';
    if (avgDailyAttempts > 8) inferredLearningStyle = 'intensive';
    else if (avgDailyAttempts < 2) inferredLearningStyle = 'spaced';
    if (persistentWeakAreas.length > 3) inferredLearningStyle = 'needs-scaffolding';

    // 10. Calculate recommended difficulty
    let recommendedDifficulty: 'easy' | 'medium' | 'hard' | 'exam-level' = 'medium';
    if (overallUnderstanding < 40) recommendedDifficulty = 'easy';
    else if (overallUnderstanding < 65) recommendedDifficulty = 'medium';
    else if (overallUnderstanding < 85) recommendedDifficulty = 'hard';
    else recommendedDifficulty = 'exam-level';

    // 11. Days until exam
    let daysUntilExam: number | null = null;
    const { data: examData } = await supabase
      .from('exam_settings' as any)
      .select('exam_date')
      .eq('user_id', user.id)
      .maybeSingle();

    if ((examData as any)?.exam_date) {
      const examDate = new Date((examData as any).exam_date);
      daysUntilExam = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / 86_400_000));
    }

    // If no exam_settings date, check subject_exams
    if (daysUntilExam === null) {
      const { data: subjectExams } = await supabase
        .from('subject_exams' as any)
        .select('exam_date')
        .eq('user_id', user.id)
        .gte('exam_date', new Date().toISOString().split('T')[0])
        .order('exam_date', { ascending: true })
        .limit(1);

      if (subjectExams && subjectExams.length > 0) {
        const examDate = new Date((subjectExams[0] as any).exam_date);
        daysUntilExam = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / 86_400_000));
      }
    }

    // 12. Build revision priority queue
    const revisionPriority: { topic: string; subject: string; urgency: number; reason: string }[] = [];

    for (const [topic, acc] of Object.entries(topicAccuracy)) {
      const accuracy = acc.total > 0 ? acc.correct / acc.total : 0;
      let urgency = 0;
      let reason = '';

      if (accuracy < 0.4 && acc.total >= 3) {
        urgency = 95;
        reason = `Very low accuracy (${Math.round(accuracy * 100)}%) across ${acc.total} attempts — needs immediate attention`;
      } else if (accuracy < 0.6 && acc.total >= 2) {
        urgency = 75;
        reason = `Below passing threshold (${Math.round(accuracy * 100)}%) — needs focused practice`;
      } else if (accuracy < 0.7) {
        urgency = 50;
        reason = `Borderline performance (${Math.round(accuracy * 100)}%) — reinforce with practice`;
      }

      // Boost urgency if exam is near
      if (daysUntilExam !== null && daysUntilExam < 30 && urgency > 0) {
        urgency = Math.min(100, urgency + 15);
        reason += ` [EXAM IN ${daysUntilExam} DAYS]`;
      }

      if (urgency > 0) {
        // Find the subject for this topic
        const matchedSubject = (subjects || []).find((s: any) => {
          const topics = Array.isArray(s.topics) ? s.topics : [];
          return topics.some((t: any) =>
            t.name?.toLowerCase().includes(topic.toLowerCase()) ||
            topic.toLowerCase().includes(t.name?.toLowerCase() || '')
          );
        });

        revisionPriority.push({
          topic,
          subject: matchedSubject ? (matchedSubject as any).name : 'Unknown',
          urgency,
          reason,
        });
      }
    }

    revisionPriority.sort((a, b) => b.urgency - a.urgency);

    // Time per topic trend (simplified)
    const timePerTopicTrend: Record<string, number> = {};
    for (const [topic, acc] of Object.entries(topicAccuracy)) {
      // Estimate ~2 min per attempt as proxy
      timePerTopicTrend[topic] = acc.total * 2;
    }

    const profile: StudentLearningProfile = {
      overallUnderstanding,
      subjectUnderstanding,
      learningPace,
      persistentWeakAreas,
      strengths,
      inferredLearningStyle,
      timePerTopicTrend,
      accuracyTrend,
      recommendedDifficulty,
      daysUntilExam,
      revisionPriority: revisionPriority.slice(0, 15),
    };

    // Cache the profile
    try {
      localStorage.setItem(LEARNING_PROFILE_CACHE_KEY, JSON.stringify(profile));
    } catch { /* quota exceeded */ }

    return profile;
  }, []);

  // ── Build the complete AI context payload for any AI call ───────────────
  const buildAIContext = useCallback(async (): Promise<AIContextPayload> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        curriculumContext: '',
        performanceContext: '',
        syllabusData: '',
        pastPaperData: '',
        examBoardContext: '',
        weakAreas: [],
        studyRecommendations: '',
        difficultyLevel: 'medium',
        timeContext: '',
        notesContext: '',
      };
    }

    // Build intelligence and profile in parallel
    const [intelligence, learningProfile] = await Promise.all([
      buildSyllabusIntelligence(),
      buildLearningProfile(),
    ]);

    const profile = academicProfile || profileRef.current;

    // ── Curriculum context ───────────────────────────────────────────────
    const currParts: string[] = [];
    if (profile) {
      currParts.push(`=== STUDENT ACADEMIC PROFILE ===`);
      currParts.push(`Curriculum: ${profile.curriculum || 'Not set'}`);
      currParts.push(`Grade: ${profile.grade || 'Not set'}`);
      if (profile.exam_year) currParts.push(`Exam Year: ${profile.exam_year}`);
      if (profile.exam_board) currParts.push(`Exam Board: ${profile.exam_board}`);
      if (profile.school_name) currParts.push(`School: ${profile.school_name}`);
      if (profile.target_grade) currParts.push(`Target Grade: ${profile.target_grade}`);
      if (profile.learning_style) currParts.push(`Learning Style: ${profile.learning_style}`);
      if (profile.goals) currParts.push(`Goals: ${profile.goals}`);
    }

    if (intelligence) {
      currParts.push(`\n=== REGISTERED SYLLABUS CODES ===`);
      for (const [subject, code] of Object.entries(intelligence.syllabusCodeMap)) {
        const papers = intelligence.paperCodeMap[subject] || [];
        currParts.push(`${subject}: ${code}${papers.length ? ` | Papers: ${papers.join(', ')}` : ''}`);
      }
    }

    // ── Performance context ──────────────────────────────────────────────
    const perfParts: string[] = [];
    if (learningProfile) {
      perfParts.push(`=== STUDENT LEARNING PROFILE ===`);
      perfParts.push(`Overall Understanding: ${learningProfile.overallUnderstanding}%`);
      perfParts.push(`Learning Pace: ${learningProfile.learningPace}`);
      perfParts.push(`Recommended Difficulty: ${learningProfile.recommendedDifficulty}`);
      perfParts.push(`Learning Style: ${learningProfile.inferredLearningStyle}`);

      if (Object.keys(learningProfile.subjectUnderstanding).length > 0) {
        perfParts.push(`\nPer-Subject Understanding:`);
        for (const [subj, level] of Object.entries(learningProfile.subjectUnderstanding)) {
          const status = level >= 80 ? 'STRONG' : level >= 60 ? 'MODERATE' : 'WEAK';
          perfParts.push(`  ${subj}: ${level}% [${status}]`);
        }
      }

      if (learningProfile.persistentWeakAreas.length > 0) {
        perfParts.push(`\nPERSISTENT WEAK AREAS (MUST PRIORITISE):`);
        learningProfile.persistentWeakAreas.forEach(t => perfParts.push(`  - ${t}`));
      }

      if (learningProfile.strengths.length > 0) {
        perfParts.push(`\nStrengths (can reduce time): ${learningProfile.strengths.join(', ')}`);
      }

      if (learningProfile.revisionPriority.length > 0) {
        perfParts.push(`\n=== REVISION PRIORITY QUEUE ===`);
        learningProfile.revisionPriority.slice(0, 8).forEach((r, i) => {
          perfParts.push(`  ${i + 1}. ${r.topic} (${r.subject}) — Urgency: ${r.urgency}/100 — ${r.reason}`);
        });
      }
    }

    // ── Syllabus data from parsed documents ──────────────────────────────
    const { data: docsData } = await supabase
      .from('documents')
      .select('type, subject, parsed_content')
      .eq('user_id', user.id)
      .eq('is_processed', true);

    const docs = (docsData || []) as any[];
    let syllabusData = '';
    let pastPaperData = '';
    let notesContext = '';

    for (const doc of docs) {
      const content = doc.parsed_content;
      if (!content) continue;

      if (doc.type === 'syllabus' && content.topics) {
        const topicList = (content.topics as any[])
          .slice(0, 25)
          .map((t: any) =>
            `- ${t.name}` +
            (t.examWeight ? ` (${t.examWeight}% weight)` : '') +
            (t.subtopics?.length ? `: ${t.subtopics.slice(0, 5).join(', ')}` : '') +
            (t.learningObjectives?.length ? `\n  Objectives: ${t.learningObjectives.slice(0, 3).join('; ')}` : '')
          )
          .join('\n');
        syllabusData += `[${doc.subject}]\n${topicList}\n\n`;
      }

      if (doc.type === 'past_paper' && content.questions) {
        const qList = (content.questions as any[])
          .slice(0, 15)
          .map((q: any) =>
            `Q${q.question_number || ''}: ${q.topic || 'Unknown'} ` +
            `[${q.marks || '?'}m, ${q.difficulty || 'med'}]` +
            (q.command_words?.length ? ` CMD: ${q.command_words.join(', ')}` : '') +
            (q.concepts_tested?.length ? ` CONCEPTS: ${q.concepts_tested.slice(0, 3).join(', ')}` : '')
          )
          .join('\n');
        pastPaperData += `[${doc.subject}]\n${qList}\n\n`;
      }

      if (doc.type === 'notes' && content.key_concepts) {
        const conceptList = (content.key_concepts as any[])
          .slice(0, 15)
          .map((c: any) => `- ${c.concept}: ${c.definition?.substring(0, 120) || ''}`)
          .join('\n');
        notesContext += `[${doc.subject}]\n${conceptList}\n\n`;
      }
    }

    // ── Exam board context (internet enrichment instruction) ─────────────
    const examBoardContext = intelligence?.examBoardUpdates || '';

    // ── Study recommendations ────────────────────────────────────────────
    const recParts: string[] = [];
    if (learningProfile) {
      recParts.push(`=== AI STUDY RECOMMENDATIONS ===`);

      // Pace-based recommendations
      if (learningProfile.learningPace === 'slow') {
        recParts.push(`- Student is a slower learner. Break down concepts into smaller steps.`);
        recParts.push(`- Use more examples and analogies before asking exam questions.`);
        recParts.push(`- Start with easier questions and gradually increase difficulty.`);
      } else if (learningProfile.learningPace === 'fast') {
        recParts.push(`- Student learns quickly. Challenge with higher-order thinking questions.`);
        recParts.push(`- Include multi-step problems and application-based questions.`);
        recParts.push(`- Introduce past paper questions early.`);
      }

      // Exam pressure
      if (learningProfile.daysUntilExam !== null) {
        if (learningProfile.daysUntilExam < 14) {
          recParts.push(`\n*** EXAM IN ${learningProfile.daysUntilExam} DAYS — EXAM READINESS MODE ***`);
          recParts.push(`- Focus ONLY on past paper practice and weak areas.`);
          recParts.push(`- Generate exam-style questions with strict time allocation.`);
          recParts.push(`- Include mark scheme breakdowns and examiner tips.`);
        } else if (learningProfile.daysUntilExam < 30) {
          recParts.push(`\n** Exam approaching (${learningProfile.daysUntilExam} days). Shift to revision mode. **`);
          recParts.push(`- Mix new content with past paper practice.`);
          recParts.push(`- Prioritise weak areas identified in revision queue.`);
        } else if (learningProfile.daysUntilExam < 60) {
          recParts.push(`\nExam in ${learningProfile.daysUntilExam} days — balanced study/revision.`);
        }
      }

      // Understanding-based
      if (learningProfile.overallUnderstanding < 40) {
        recParts.push(`\n- FOUNDATIONAL GAPS DETECTED: Build understanding from basics.`);
        recParts.push(`- Use scaffolded learning: explain concepts before testing.`);
      } else if (learningProfile.overallUnderstanding >= 80) {
        recParts.push(`\n- Strong student. Focus on exam technique and time management.`);
        recParts.push(`- Practice full past papers under timed conditions.`);
      }
    }

    // ── Time context ─────────────────────────────────────────────────────
    let timeContext = '';
    if (learningProfile?.daysUntilExam !== null && learningProfile?.daysUntilExam !== undefined) {
      timeContext = `Days until exam: ${learningProfile.daysUntilExam}. `;
      if (learningProfile.daysUntilExam < 7) {
        timeContext += 'CRITICAL: Exam is THIS WEEK. Focus on exam practice only.';
      } else if (learningProfile.daysUntilExam < 14) {
        timeContext += 'URGENT: Exam in 2 weeks. Intensive revision and past papers.';
      } else if (learningProfile.daysUntilExam < 30) {
        timeContext += 'Exam approaching. Balance revision with new content.';
      } else {
        timeContext += 'Sufficient time. Systematic coverage with regular review.';
      }
    }

    return {
      curriculumContext: currParts.join('\n'),
      performanceContext: perfParts.join('\n'),
      syllabusData,
      pastPaperData,
      examBoardContext,
      weakAreas: learningProfile?.persistentWeakAreas || [],
      studyRecommendations: recParts.join('\n'),
      difficultyLevel: learningProfile?.recommendedDifficulty || 'medium',
      timeContext,
      notesContext,
    };
  }, [academicProfile, buildSyllabusIntelligence, buildLearningProfile]);

  // ── Enrich syllabus data (can use internet via AI) ─────────────────────
  const enrichSyllabusData = useCallback(async (force = false) => {
    if (enrichmentRef.current) return;

    // Check cooldown
    if (!force && state.lastEnriched) {
      const hoursSince = (Date.now() - state.lastEnriched.getTime()) / 3_600_000;
      if (hoursSince < ENRICHMENT_COOLDOWN_HOURS) return;
    }

    enrichmentRef.current = true;
    setState(prev => ({ ...prev, isEnriching: true, error: null }));

    try {
      const intelligence = await buildSyllabusIntelligence();
      if (!intelligence) {
        setState(prev => ({ ...prev, isEnriching: false }));
        return;
      }

      // Call AI to enrich syllabus data with internet access
      try {
        const enrichResult = await aiRequestJSON<{
          enriched_topics?: any[];
          exam_updates?: string;
          study_tips?: Record<string, string>;
        }>('generate-task-content', {
          taskType: 'syllabus-enrichment',
          subject: 'all',
          topic: 'syllabus-intelligence',
          curriculumContext:
            `${intelligence.curriculumIdentifier}\n\n` +
            `${intelligence.examBoardUpdates}\n\n` +
            `Registered subjects with codes:\n` +
            Object.entries(intelligence.syllabusCodeMap)
              .map(([s, c]) => `  ${s}: ${c} | Papers: ${(intelligence.paperCodeMap[s] || []).join(', ')}`)
              .join('\n') +
            `\n\nExisting topic data:\n` +
            intelligence.enrichedTopics
              .slice(0, 20)
              .map(t => `  ${t.subject} > ${t.topic} (weight: ${t.examWeight}%)`)
              .join('\n'),
          performanceContext:
            'ENRICHMENT MODE: Use your internet access and knowledge base to:\n' +
            '1. Look up the official syllabus specification for each code\n' +
            '2. Verify topic weightings from the latest examination reports\n' +
            '3. Identify any syllabus changes or additions for the current exam year\n' +
            '4. Compile examiner report insights (common mistakes, what examiners look for)\n' +
            '5. Return enriched topic data with updated objectives and exam focus points\n' +
            'Return as JSON with enriched_topics array and exam_updates string.',
        });

        // Update enriched topics if AI returned useful data
        if (enrichResult.enriched_topics && Array.isArray(enrichResult.enriched_topics)) {
          for (const et of enrichResult.enriched_topics) {
            const match = intelligence.enrichedTopics.find(
              t => t.subject.toLowerCase() === et.subject?.toLowerCase() &&
                   t.topic.toLowerCase() === et.topic?.toLowerCase()
            );
            if (match) {
              if (et.learningObjectives) match.learningObjectives = et.learningObjectives;
              if (et.examinerFocusPoints) match.examinerFocusPoints = et.examinerFocusPoints;
              if (et.commonMistakes) match.commonMistakes = et.commonMistakes;
              if (et.studyApproach) match.studyApproach = et.studyApproach;
              if (et.commandWords) match.commandWords = et.commandWords;
            }
          }
        }

        if (enrichResult.exam_updates) {
          intelligence.examBoardUpdates += '\n\n=== AI-ENRICHED UPDATES ===\n' + enrichResult.exam_updates;
        }
      } catch (enrichErr) {
        console.warn('[AIStudyIntelligence] AI enrichment failed (non-critical):', enrichErr);
      }

      // Cache the intelligence
      try {
        localStorage.setItem(ENRICHMENT_CACHE_KEY, JSON.stringify({
          intelligence,
          timestamp: new Date().toISOString(),
        }));
      } catch { /* quota */ }

      setState(prev => ({
        ...prev,
        isEnriching: false,
        syllabusIntelligence: intelligence,
        lastEnriched: new Date(),
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState(prev => ({ ...prev, isEnriching: false, error: msg }));
    } finally {
      enrichmentRef.current = false;
    }
  }, [state.lastEnriched, buildSyllabusIntelligence]);

  // ── Refresh both intelligence and learning profile ─────────────────────
  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const [intelligence, learningProfile] = await Promise.all([
        buildSyllabusIntelligence(),
        buildLearningProfile(),
      ]);

      setState(prev => ({
        ...prev,
        isLoading: false,
        syllabusIntelligence: intelligence,
        learningProfile,
      }));

      return { intelligence, learningProfile };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState(prev => ({ ...prev, isLoading: false, error: msg }));
      return null;
    }
  }, [buildSyllabusIntelligence, buildLearningProfile]);

  // ── Auto-enrich on mount if profile exists ────────────────────────────
  useEffect(() => {
    if (academicProfile) {
      profileRef.current = academicProfile;
      // Kick off background enrichment
      const timer = setTimeout(() => {
        enrichSyllabusData().catch(console.warn);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [academicProfile, enrichSyllabusData]);

  // ── Auto-refresh learning profile when academic profile changes ────────
  useEffect(() => {
    if (academicProfile) {
      const timer = setTimeout(() => {
        buildLearningProfile().then(profile => {
          if (profile) {
            setState(prev => ({ ...prev, learningProfile: profile }));
          }
        }).catch(console.warn);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [academicProfile, buildLearningProfile]);

  return {
    ...state,
    buildAIContext,
    buildSyllabusIntelligence,
    buildLearningProfile,
    enrichSyllabusData,
    refresh,
  };
}
