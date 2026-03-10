export interface Subject {
  id: string;
  name: string;
  color: string;
  icon: string;
  currentTopic: Topic;
  topics: Topic[];
  overallMastery: number;
}

export interface Topic {
  id: string;
  name: string;
  subtopics: string[];
  mastery: number;
  isLocked: boolean;
  prerequisites: string[];
  examWeight: number;
}

export interface DailyTask {
  id: string;
  type: 'micro-revision' | 'concept-learning' | 'active-recall' | 'exam-question' | 'flashcards' | 'summary' | 'revision-checklist';
  title: string;
  description: string;
  isCompleted: boolean;
  isLocked: boolean;
  subjectId: string;
}

export interface ReadinessCheck {
  sleep: number;
  energy: number;
  mood: number;
}

export interface ExamQuestion {
  id: string;
  question: string;
  marks: number;
  topic: string;
  subject: string;
  analysisRequired: boolean;
}

export interface QuestionAnalysis {
  givenInfo: string;
  requiredAnswer: string;
  keywords: string[];
  strategy: string;
}

export interface UserProgress {
  xp: number;
  streak: number;
  badges: Badge[];
  dailyTasksCompleted: number;
  examQuestionsCompleted: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt?: Date;
}

export interface DailySummary {
  date: Date;
  topicsStudied: string[];
  examQuestionsCompleted: number;
  masteryUpdates: { topic: string; before: number; after: number }[];
  xpEarned: number;
}
