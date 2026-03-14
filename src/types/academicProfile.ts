// ─── Academic Profile Types ──────────────────────────────────────────────────
// Drives library personalization, tutor recommendations, and StudyMode

export type Curriculum =
  | "ZIMSEC"
  | "CAMB"
  | "IEB"
  | "NSC"
  | "IGCSE"
  | "OTHER";

export type GradeLevel =
  | "Grade 1" | "Grade 2" | "Grade 3" | "Grade 4"
  | "Grade 5" | "Grade 6" | "Grade 7"
  | "Grade 8" | "Grade 9"
  | "Grade 10" | "Grade 11" | "Grade 12"
  | "Form 1" | "Form 2" | "Form 3" | "Form 4" | "Form 5" | "Form 6"
  | "A-Level" | "O-Level"
  | "Year 1" | "Year 2" | "Year 3" | "Year 4";

export interface AcademicProfile {
  id?: string;
  user_id: string;
  curriculum: Curriculum;
  grade: GradeLevel;
  subjects: string[];
  exam_year?: number | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Library Resource Types ───────────────────────────────────────────────────

export type ResourceType = "video" | "book" | "pdf" | "pastpaper" | "guide";

export interface ResourceTag {
  subject: string;
  topic: string;
  subtopic?: string;
  grade: string;
  curriculum: Curriculum;
}

export interface TutorialTutor {
  id: string;
  name: string;
  avatar_url?: string;
  rating: number;
  topic_rating?: number;   // Rating specifically for this topic
  reviews: number;
}

export interface LibraryResource {
  id: number | string;
  title: string;
  author: string;
  type: ResourceType;
  category: string;
  gradeLevel: string;
  summary: string;
  rating: number;
  reviews: number;
  thumbnail: string;
  isOffline: boolean;
  duration: string;
  // New fields
  tags?: ResourceTag;
  tutor?: TutorialTutor;
  isTutorial?: boolean;
  watchCount?: number;
  completionRate?: number;
  videoUrl?: string;
}

// ─── Tutor Ranking ────────────────────────────────────────────────────────────

export interface TopicTutorRanking {
  tutorId: string;
  tutorName: string;
  avatar_url?: string;
  subject: string;
  topic: string;
  topicRating: number;
  totalReviews: number;
  completionRate: number;  // % of sessions on this topic completed
  successRate: number;     // % of students who improved
}

// ─── Curriculum subject maps ──────────────────────────────────────────────────

export const CURRICULUM_SUBJECTS: Record<Curriculum, string[]> = {
  ZIMSEC: [
    "Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "Combined Science",
    "English Language",
    "English Literature",
    "History",
    "Geography",
    "Accounts",
    "Business Studies",
    "Economics",
    "Computer Science",
    "Agriculture",
    "Shona",
    "Ndebele",
    "Art & Design",
    "Music",
  ],
  CAMB: [
    "Mathematics",
    "Additional Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "English Language",
    "English Literature",
    "History",
    "Geography",
    "Accounting",
    "Business Studies",
    "Economics",
    "Computer Science",
    "French",
    "Art & Design",
  ],
  IEB: [
    "Mathematics",
    "Mathematical Literacy",
    "Physical Sciences",
    "Life Sciences",
    "English Home Language",
    "Afrikaans",
    "History",
    "Geography",
    "Accounting",
    "Business Studies",
    "Economics",
    "Computer Applications Technology",
    "Information Technology",
    "Life Orientation",
  ],
  NSC: [
    "Mathematics",
    "Mathematical Literacy",
    "Physical Sciences",
    "Life Sciences",
    "English Home Language",
    "Afrikaans First Additional Language",
    "History",
    "Geography",
    "Accounting",
    "Business Studies",
    "Economics",
    "Computer Applications Technology",
    "Information Technology",
    "Life Orientation",
    "Tourism",
  ],
  IGCSE: [
    "Mathematics",
    "Additional Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "English as a Second Language",
    "English Literature",
    "History",
    "Geography",
    "Accounting",
    "Business Studies",
    "Economics",
    "Computer Science",
  ],
  OTHER: [
    "Mathematics",
    "English",
    "Science",
    "History",
    "Geography",
    "Accounting",
    "Business Studies",
    "Economics",
    "Computer Science",
    "Biology",
    "Physics",
    "Chemistry",
  ],
};

export const GRADE_LEVELS_BY_CURRICULUM: Record<Curriculum, GradeLevel[]> = {
  ZIMSEC: [
    "Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6",
  ],
  CAMB: [
    "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "A-Level",
  ],
  IEB: [
    "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12",
  ],
  NSC: [
    "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12",
  ],
  IGCSE: [
    "Grade 8", "Grade 9", "O-Level", "A-Level",
  ],
  OTHER: [
    "Grade 1", "Grade 2", "Grade 3", "Grade 4",
    "Grade 5", "Grade 6", "Grade 7",
    "Grade 8", "Grade 9",
    "Grade 10", "Grade 11", "Grade 12",
    "Year 1", "Year 2", "Year 3", "Year 4",
  ],
};
