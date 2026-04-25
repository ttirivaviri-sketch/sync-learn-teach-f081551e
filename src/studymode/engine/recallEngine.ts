/**
 * recallEngine.ts — Core Active Recall & Mastery Engine
 *
 * Unified data layer that feeds:
 *   1. Active Recall (10+ questions per topic, semantic evaluation)
 *   2. Mastery System (accuracy + improvement + consistency)
 *   3. Spaced Repetition (SM-2 scheduler)
 *   4. Exam Mode (timed, marks, examiner grading)
 *   5. Personalization (adaptive difficulty)
 *   6. Insights Dashboard (trends, weak areas, common mistakes)
 *
 * Every answer (correct or incorrect) flows through recordAnswer() which
 * updates mastery scores, spaced-repetition schedules, question selection
 * weights, and the personalization engine.
 */

// ── Types ──────────────────────────────────────────────────────────────────

import type { QuestionVisualSpec } from '../components/QuestionVisual';

export type QuestionType = 'multiple_choice' | 'short_answer' | 'structured' | 'explain' | 'application';
export type DifficultyLevel = 'foundation' | 'standard' | 'advanced';
export type MasteryClassification = 'mastered' | 'developing' | 'needs_reinforcement';

export interface RecallQuestion {
  id: string;
  question: string;
  questionType: QuestionType;
  marks: number;
  topic: string;
  subtopic?: string;
  subject: string;
  subjectId?: string;
  difficulty: DifficultyLevel;
  commandWord?: string;
  /** Expected key concepts the answer should contain */
  keyConcepts: string[];
  /** Full model answer */
  modelAnswer: string;
  /** Point-by-point marking scheme */
  markingScheme: string[];
  /** Step-by-step solution for worked examples */
  stepByStepSolution?: string;
  /** For multiple choice */
  options?: string[];
  correctOption?: string;
  /** Time allocation in seconds (for exam mode) */
  timeAllocationSecs: number;
  /** Spaced repetition: has this been incorrectly answered before? */
  isPreviouslyIncorrect?: boolean;
  /** Priority weight for selection (higher = more likely to appear) */
  selectionWeight: number;
  /** Concepts being tested */
  conceptsTested: string[];
  /** Source: 'ai-generated' | 'past-paper' | 'spaced-review' */
  source: 'ai-generated' | 'past-paper' | 'spaced-review';
}

export interface SemanticEvaluation {
  /** 0-100 accuracy score */
  score: number;
  totalMarks: number;
  marksAwarded: number;
  percentage: number;
  /** Concepts the student got right */
  correctConcepts: string[];
  /** Concepts that were missing from the answer */
  missingConcepts: string[];
  /** Concepts the student got wrong / misconceptions */
  misconceptions: string[];
  /** Structured feedback */
  feedback: {
    whatWasCorrect: string;
    whatWasMissing: string;
    whatWasMisunderstood: string;
    modelAnswer: string;
    lostMarksExplanation: string;
    /** Why specific parts are wrong (reasoning detection) */
    reasoningErrors: string[];
  };
  /** Point-by-point mark breakdown */
  markBreakdown: {
    criterion: string;
    marksAwarded: number;
    marksAvailable: number;
    comment: string;
  }[];
  /** Tips for improvement */
  improvementTips: string[];
}

export interface AnswerRecord {
  questionId: string;
  question: string;
  userAnswer: string;
  topic: string;
  subtopic?: string;
  subject: string;
  subjectId?: string;
  difficulty: DifficultyLevel;
  evaluation: SemanticEvaluation;
  conceptsTested: string[];
  commandWord?: string;
  timestamp: string;
  /** Time taken in seconds */
  timeTakenSecs: number;
  /** Whether this was an exam-mode answer */
  isExamMode: boolean;
}

export interface TopicMastery {
  topic: string;
  subject: string;
  /** Classification based on accuracy + improvement + consistency */
  classification: MasteryClassification;
  /** Current accuracy (0-1) */
  accuracy: number;
  /** Improvement trend over last N sessions (-1 to 1) */
  improvementTrend: number;
  /** Consistency score (0-1): how stable are results */
  consistencyScore: number;
  /** Total attempts */
  totalAttempts: number;
  /** Correct attempts */
  correctAttempts: number;
  /** Concepts mastered vs total */
  conceptsMastered: number;
  conceptsTotal: number;
  /** Weak concepts */
  weakConcepts: string[];
  /** Last attempt date */
  lastAttemptDate: string | null;
  /** Spaced review: next review date */
  nextReviewDate: string | null;
  /** SM-2 ease factor */
  easeFactor: number;
  /** SM-2 interval in days */
  intervalDays: number;
}

export interface StudentInsight {
  id: string;
  type: 'strength' | 'weakness' | 'pattern' | 'recommendation';
  title: string;
  description: string;
  subject?: string;
  topic?: string;
  severity: 'info' | 'warning' | 'critical';
  /** e.g. "Student struggles with application questions" */
  pattern?: string;
  createdAt: string;
}

export interface SessionStats {
  questionsAnswered: number;
  correctAnswers: number;
  totalMarks: number;
  marksAwarded: number;
  averageScore: number;
  averageTimeSecs: number;
  topicsCovers: string[];
  strongConcepts: string[];
  weakConcepts: string[];
  sessionDurationSecs: number;
}

// ── SM-2 Spaced Repetition ─────────────────────────────────────────────────

export function calculateSM2(
  wasCorrect: boolean,
  currentEase: number,
  currentInterval: number,
  reviewCount: number,
): { newInterval: number; newEase: number } {
  const quality = wasCorrect ? 4 : 1;
  let newEase = currentEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEase = Math.max(1.3, newEase);

  let newInterval: number;
  if (!wasCorrect) {
    newInterval = 1; // Reset on incorrect
  } else if (reviewCount <= 1) {
    newInterval = reviewCount === 0 ? 1 : 3;
  } else {
    newInterval = Math.round(currentInterval * newEase);
  }

  return { newInterval: Math.min(180, newInterval), newEase };
}

// ── Mastery Classification ─────────────────────────────────────────────────

export function classifyMastery(
  accuracy: number,
  improvementTrend: number,
  consistencyScore: number,
  totalAttempts: number,
): MasteryClassification {
  if (totalAttempts < 3) return 'needs_reinforcement';

  // Mastered: high accuracy + stable + not declining
  if (accuracy >= 0.75 && consistencyScore >= 0.6 && improvementTrend >= -0.1) {
    return 'mastered';
  }

  // Developing: moderate accuracy OR improving
  if (accuracy >= 0.45 || improvementTrend > 0.15) {
    return 'developing';
  }

  return 'needs_reinforcement';
}

// ── Improvement Trend ──────────────────────────────────────────────────────

/**
 * Calculate improvement trend from recent scores.
 * Returns -1 to 1: positive = improving, negative = declining.
 */
export function calculateImprovementTrend(recentScores: number[]): number {
  if (recentScores.length < 2) return 0;

  const n = recentScores.length;
  const half = Math.ceil(n / 2);
  const firstHalf = recentScores.slice(0, half);
  const secondHalf = recentScores.slice(half);

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  // Normalize to -1..1
  return Math.max(-1, Math.min(1, (avgSecond - avgFirst) / 50));
}

// ── Consistency Score ──────────────────────────────────────────────────────

/**
 * Calculate consistency score from recent scores.
 * Returns 0-1: 1 = perfectly consistent, 0 = wildly varying.
 */
export function calculateConsistencyScore(recentScores: number[]): number {
  if (recentScores.length < 2) return 0;

  const mean = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const variance = recentScores.reduce((a, b) => a + (b - mean) ** 2, 0) / recentScores.length;
  const stdDev = Math.sqrt(variance);

  // Normalize: stdDev of 0 = 1.0, stdDev of 50+ = 0
  return Math.max(0, 1 - stdDev / 50);
}

// ── Adaptive Difficulty ────────────────────────────────────────────────────

export function recommendDifficulty(mastery: TopicMastery): DifficultyLevel {
  if (mastery.accuracy < 0.4 || mastery.classification === 'needs_reinforcement') {
    return 'foundation';
  }
  if (mastery.accuracy >= 0.75 && mastery.classification === 'mastered') {
    return 'advanced';
  }
  return 'standard';
}

// ── Question Selection Weighting ───────────────────────────────────────────

/**
 * Compute selection weight for a question in the pool.
 * Higher weight = more likely to be selected.
 *
 * Factors:
 *   - Previously incorrect → 3x weight
 *   - Due for spaced review → 2x weight
 *   - Targets weak concepts → 2x weight
 *   - Not attempted recently → 1.5x weight
 */
export function computeSelectionWeight(opts: {
  isPreviouslyIncorrect: boolean;
  isDueForReview: boolean;
  targetsWeakConcepts: boolean;
  daysSinceLastAttempt: number | null;
}): number {
  let weight = 1;
  if (opts.isPreviouslyIncorrect) weight *= 3;
  if (opts.isDueForReview) weight *= 2;
  if (opts.targetsWeakConcepts) weight *= 2;
  if (opts.daysSinceLastAttempt === null || opts.daysSinceLastAttempt > 7) weight *= 1.5;
  return weight;
}

// ── Insight Generation ─────────────────────────────────────────────────────

export function generateInsightsFromHistory(
  answers: AnswerRecord[],
  masteries: TopicMastery[],
): StudentInsight[] {
  const insights: StudentInsight[] = [];
  const now = new Date().toISOString();

  // Pattern: struggles with application questions
  const appQuestions = answers.filter((a) => a.commandWord?.toLowerCase() === 'apply' || a.commandWord?.toLowerCase() === 'evaluate');
  if (appQuestions.length >= 3) {
    const avgScore = appQuestions.reduce((s, a) => s + a.evaluation.percentage, 0) / appQuestions.length;
    if (avgScore < 50) {
      insights.push({
        id: `insight-app-${Date.now()}`,
        type: 'pattern',
        title: 'Struggles with application questions',
        description: `Average score of ${Math.round(avgScore)}% on application/evaluation questions. Focus on practising how to apply concepts to new scenarios.`,
        severity: 'warning',
        pattern: 'application_questions',
        createdAt: now,
      });
    }
  }

  // Pattern: lacks depth in explanations
  const explainQuestions = answers.filter((a) =>
    a.commandWord?.toLowerCase() === 'explain' || a.commandWord?.toLowerCase() === 'describe',
  );
  if (explainQuestions.length >= 3) {
    const missingConceptsAvg =
      explainQuestions.reduce((s, a) => s + a.evaluation.missingConcepts.length, 0) / explainQuestions.length;
    if (missingConceptsAvg > 2) {
      insights.push({
        id: `insight-depth-${Date.now()}`,
        type: 'pattern',
        title: 'Lacks depth in explanations',
        description: `On average, missing ${Math.round(missingConceptsAvg)} key concepts per explanation question. Answers need more detail and supporting points.`,
        severity: 'warning',
        pattern: 'explanation_depth',
        createdAt: now,
      });
    }
  }

  // Common misconceptions across topics
  const allMisconceptions = answers.flatMap((a) => a.evaluation.misconceptions);
  const misconceptionFreq: Record<string, number> = {};
  allMisconceptions.forEach((m) => {
    const key = m.toLowerCase().trim();
    misconceptionFreq[key] = (misconceptionFreq[key] || 0) + 1;
  });
  const repeatedMisconceptions = Object.entries(misconceptionFreq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (repeatedMisconceptions.length > 0) {
    insights.push({
      id: `insight-misconceptions-${Date.now()}`,
      type: 'weakness',
      title: 'Recurring misconceptions detected',
      description: `These misunderstandings appear repeatedly: ${repeatedMisconceptions.map(([m, c]) => `"${m}" (${c}x)`).join(', ')}. Targeted review is recommended.`,
      severity: 'critical',
      createdAt: now,
    });
  }

  // Per-topic weak areas
  for (const mastery of masteries) {
    if (mastery.classification === 'needs_reinforcement' && mastery.totalAttempts >= 3) {
      insights.push({
        id: `insight-weak-${mastery.topic}-${Date.now()}`,
        type: 'weakness',
        title: `${mastery.topic} needs reinforcement`,
        description: `Only ${Math.round(mastery.accuracy * 100)}% accuracy after ${mastery.totalAttempts} attempts. ${mastery.weakConcepts.length > 0 ? `Weak concepts: ${mastery.weakConcepts.join(', ')}` : ''}`,
        severity: mastery.accuracy < 0.3 ? 'critical' : 'warning',
        subject: mastery.subject,
        topic: mastery.topic,
        createdAt: now,
      });
    }

    if (mastery.classification === 'mastered') {
      insights.push({
        id: `insight-strong-${mastery.topic}-${Date.now()}`,
        type: 'strength',
        title: `${mastery.topic} — Mastered`,
        description: `${Math.round(mastery.accuracy * 100)}% accuracy with consistent performance. Continue with periodic review to maintain.`,
        severity: 'info',
        subject: mastery.subject,
        topic: mastery.topic,
        createdAt: now,
      });
    }
  }

  // Improvement trends
  const improving = masteries.filter((m) => m.improvementTrend > 0.2);
  if (improving.length > 0) {
    insights.push({
      id: `insight-improving-${Date.now()}`,
      type: 'recommendation',
      title: 'Improvement trend detected',
      description: `Showing improvement in: ${improving.map((m) => m.topic).join(', ')}. Keep up the momentum!`,
      severity: 'info',
      createdAt: now,
    });
  }

  const declining = masteries.filter((m) => m.improvementTrend < -0.2 && m.totalAttempts >= 5);
  if (declining.length > 0) {
    insights.push({
      id: `insight-declining-${Date.now()}`,
      type: 'recommendation',
      title: 'Performance declining',
      description: `Scores dropping in: ${declining.map((m) => m.topic).join(', ')}. Consider revisiting fundamentals and seeking tutor help.`,
      severity: 'warning',
      createdAt: now,
    });
  }

  return insights;
}

// ── Session Utilities ──────────────────────────────────────────────────────

export function computeSessionStats(
  answers: AnswerRecord[],
  sessionStartTime: number,
): SessionStats {
  const n = answers.length;
  if (n === 0) {
    return {
      questionsAnswered: 0,
      correctAnswers: 0,
      totalMarks: 0,
      marksAwarded: 0,
      averageScore: 0,
      averageTimeSecs: 0,
      topicsCovers: [],
      strongConcepts: [],
      weakConcepts: [],
      sessionDurationSecs: Math.floor((Date.now() - sessionStartTime) / 1000),
    };
  }

  const correctAnswers = answers.filter((a) => a.evaluation.percentage >= 50).length;
  const totalMarks = answers.reduce((s, a) => s + a.evaluation.totalMarks, 0);
  const marksAwarded = answers.reduce((s, a) => s + a.evaluation.marksAwarded, 0);
  const averageScore = answers.reduce((s, a) => s + a.evaluation.percentage, 0) / n;
  const averageTimeSecs = answers.reduce((s, a) => s + a.timeTakenSecs, 0) / n;

  const allCorrectConcepts = answers.flatMap((a) => a.evaluation.correctConcepts);
  const allMissingConcepts = answers.flatMap((a) => a.evaluation.missingConcepts);

  const conceptFreq = (concepts: string[]) => {
    const freq: Record<string, number> = {};
    concepts.forEach((c) => {
      const k = c.toLowerCase().trim();
      freq[k] = (freq[k] || 0) + 1;
    });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
  };

  return {
    questionsAnswered: n,
    correctAnswers,
    totalMarks,
    marksAwarded,
    averageScore: Math.round(averageScore),
    averageTimeSecs: Math.round(averageTimeSecs),
    topicsCovers: [...new Set(answers.map((a) => a.topic))],
    strongConcepts: conceptFreq(allCorrectConcepts).slice(0, 5),
    weakConcepts: conceptFreq(allMissingConcepts).slice(0, 5),
    sessionDurationSecs: Math.floor((Date.now() - sessionStartTime) / 1000),
  };
}
