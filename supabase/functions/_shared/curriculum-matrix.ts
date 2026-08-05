// Mirror of src/types/academicProfile.ts CURRICULUM_SUBJECTS / GRADE_LEVELS_BY_CURRICULUM.
// Kept Deno-friendly (no imports from src/). Alignment is enforced by
// src/lib/curriculumAlignment.test.ts — if you change subject/grade names in
// either file, that test fails until both are updated.
//
// Scope notes:
// - Subjects mirror the frontend lists 1:1 per curriculum, EXCEPT bare
//   "English" (ZIMSEC): it is an alias of "English Language" at exam levels
//   (see src/lib/subjectAliases.ts) and must not get its own template row.
// - Grades are intentionally the EXAM levels only (bulk AI-seeding budget);
//   lower grades seed lazily on first StudyMode entry.

export type Curriculum = "ZIMSEC" | "CAMB" | "IEB" | "NSC";

export const CURRICULUM_SUBJECTS: Record<Curriculum, string[]> = {
  ZIMSEC: [
    "Mathematics", "English Language", "English Literature", "Shona", "Ndebele",
    "Environmental Science", "Social Studies", "Religious & Moral Education",
    "ICT", "Physical Education", "Visual & Performing Arts",
    "Combined Science", "Physics", "Chemistry", "Biology",
    "History", "Geography", "Accounts", "Business Studies", "Economics",
    "Computer Science", "Agriculture", "Art & Design", "Music",
  ],
  CAMB: [
    "Mathematics", "Additional Mathematics", "Physics", "Chemistry", "Biology",
    "English Language", "English as a Second Language", "English Literature",
    "History", "Geography", "Accounting", "Business Studies", "Economics",
    "Computer Science", "French", "Art & Design",
  ],
  IEB: [
    "Mathematics", "Mathematical Literacy", "Physical Sciences", "Life Sciences",
    "English Home Language", "Afrikaans", "History", "Geography",
    "Accounting", "Business Studies", "Economics",
    "Computer Applications Technology", "Information Technology", "Life Orientation",
  ],
  NSC: [
    "Mathematics", "Mathematical Literacy", "Physical Sciences", "Life Sciences",
    "English Home Language", "Afrikaans First Additional Language",
    "History", "Geography", "Accounting", "Business Studies", "Economics",
    "Computer Applications Technology", "Information Technology",
    "Life Orientation", "Tourism",
  ],
};

export const GRADE_LEVELS_BY_CURRICULUM: Record<Curriculum, string[]> = {
  ZIMSEC: ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6"],
  CAMB:   ["IGCSE", "O-Level", "A-Level"],
  IEB:    ["Grade 10", "Grade 11", "Grade 12"],
  NSC:    ["Grade 10", "Grade 11", "Grade 12"],
};

export function buildMatrix(): Array<{ curriculum: Curriculum; grade: string; subject: string }> {
  const out: Array<{ curriculum: Curriculum; grade: string; subject: string }> = [];
  for (const c of Object.keys(CURRICULUM_SUBJECTS) as Curriculum[]) {
    for (const grade of GRADE_LEVELS_BY_CURRICULUM[c]) {
      for (const subject of CURRICULUM_SUBJECTS[c]) {
        out.push({ curriculum: c, grade, subject });
      }
    }
  }
  return out;
}
