/**
 * personalization.ts — Shared learner ↔ resource/tutor matcher.
 *
 * Single source of truth for matching content (clips, books, past papers)
 * AND tutors against a learner's curriculum / grade / subjects.
 *
 * Handles real-world data: grade ranges ("Grade 10-12", "Form 3-4"),
 * cross-system synonyms (Form 4 ↔ Grade 10/11 ↔ O-Level ↔ IGCSE),
 * combined labels ("Grade 10-12 / Form 3-6"), and curriculum aliases
 * (Cambridge ↔ CAMB ↔ IGCSE ↔ O-Level ↔ A-Level).
 */

const norm = (s: string | null | undefined): string =>
  (s || "").trim().toLowerCase();

// ─── Curriculum matching ──────────────────────────────────────────────────
// IGCSE / O-Level / A-Level are LEVELS within the Cambridge curriculum,
// not curricula themselves. CAPS == NSC.
const CURRICULUM_SYNONYMS: Record<string, string[]> = {
  caps: ["caps", "nsc"],
  nsc: ["caps", "nsc"],
  cambridge: ["cambridge", "camb", "igcse", "o-level", "olevel", "a-level", "alevel"],
  camb: ["cambridge", "camb", "igcse", "o-level", "olevel", "a-level", "alevel"],
  igcse: ["cambridge", "camb", "igcse"],
  "o-level": ["cambridge", "camb", "o-level", "olevel"],
  olevel: ["cambridge", "camb", "o-level", "olevel"],
  "a-level": ["cambridge", "camb", "a-level", "alevel"],
  alevel: ["cambridge", "camb", "a-level", "alevel"],
  ieb: ["ieb"],
  zimsec: ["zimsec"],
};

export function curriculumMatches(
  resourceCurriculum: string | null | undefined,
  learnerCurriculum: string | null | undefined,
): boolean {
  // Tag-tolerant: untagged resources show for everyone (cross-curriculum).
  if (!resourceCurriculum) return true;
  if (!learnerCurriculum) return true;
  const r = norm(resourceCurriculum);
  const l = norm(learnerCurriculum);
  if (r === l) return true;
  const synR = CURRICULUM_SYNONYMS[r] || [r];
  const synL = CURRICULUM_SYNONYMS[l] || [l];
  return synR.some((x) => synL.includes(x));
}

// ─── Grade matching ───────────────────────────────────────────────────────
// Each token expands to a set of canonical "atoms" (e.g. "form 4", "grade 10")
// so matching is a set-intersection.
//
// Cross-system mapping (Zimbabwe / South Africa / Cambridge):
//   Form 1 ≈ Grade 7
//   Form 2 ≈ Grade 8
//   Form 3 ≈ Grade 9
//   Form 4 ≈ Grade 10/11 ≈ O-Level / IGCSE
//   Form 5 ≈ Grade 11/12 ≈ A-Level (Lower 6th)
//   Form 6 ≈ Grade 12   ≈ A-Level (Upper 6th)

const FORM_TO_ATOMS: Record<number, string[]> = {
  1: ["form 1", "grade 7"],
  2: ["form 2", "grade 8"],
  3: ["form 3", "grade 9"],
  4: ["form 4", "grade 10", "grade 11", "o-level", "igcse"],
  5: ["form 5", "grade 11", "grade 12", "a-level"],
  6: ["form 6", "grade 12", "a-level"],
};

const GRADE_TO_ATOMS: Record<number, string[]> = {
  7: ["grade 7", "form 1"],
  8: ["grade 8", "form 2"],
  9: ["grade 9", "form 3"],
  10: ["grade 10", "form 4", "o-level"],
  11: ["grade 11", "form 4", "form 5", "o-level"],
  12: ["grade 12", "form 5", "form 6", "a-level"],
};

const BAND_ATOMS: Record<string, string[]> = {
  "junior primary": ["grade 1", "grade 2", "grade 3"],
  "senior primary": ["grade 4", "grade 5", "grade 6"],
  "junior high": ["grade 7", "grade 8", "grade 9", "form 1", "form 2", "form 3"],
  "senior high": [
    "grade 10", "grade 11", "grade 12",
    "form 4", "form 5", "form 6",
    "o-level", "a-level", "igcse",
  ],
  "all grades": ["*"],
  "all levels": ["*"],
};

function expandSingleToken(raw: string): string[] {
  let s = norm(raw);
  if (!s) return [];

  // Normalize dashes & whitespace
  s = s.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

  // Remove parenthetical context like "Grade 10 (Pure)" → "grade 10"
  s = s.replace(/\(.*?\)/g, "").trim();

  // Bands first (e.g., "Senior High")
  for (const [band, atoms] of Object.entries(BAND_ATOMS)) {
    if (s === band) return atoms;
  }

  // Levels (CAMB)
  if (/^o[\s-]?level$/.test(s)) return ["o-level", ...GRADE_TO_ATOMS[10], ...GRADE_TO_ATOMS[11]];
  if (/^a[\s-]?level$/.test(s)) return ["a-level", ...GRADE_TO_ATOMS[12]];
  if (/^igcse$/.test(s)) return ["igcse", "form 4", "grade 10", "grade 11", "o-level"];

  // "Form X" or "Form X-Y"
  const formRange = s.match(/^form\s+(\d)\s*-\s*(\d)$/);
  if (formRange) {
    const lo = +formRange[1], hi = +formRange[2];
    const out: string[] = [];
    for (let i = lo; i <= hi; i++) out.push(...(FORM_TO_ATOMS[i] || []));
    return Array.from(new Set(out));
  }
  const formSingle = s.match(/^form\s+(\d)$/);
  if (formSingle) return FORM_TO_ATOMS[+formSingle[1]] || [];

  // "Grade X" or "Grade X-Y"
  const gradeRange = s.match(/^grade\s+(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (gradeRange) {
    const lo = +gradeRange[1], hi = +gradeRange[2];
    const out: string[] = [];
    for (let i = lo; i <= hi; i++) out.push(...(GRADE_TO_ATOMS[i] || [`grade ${i}`]));
    return Array.from(new Set(out));
  }
  const gradeSingle = s.match(/^grade\s+(\d{1,2})$/);
  if (gradeSingle) {
    const g = +gradeSingle[1];
    return GRADE_TO_ATOMS[g] || [`grade ${g}`];
  }

  // "Year N"
  const year = s.match(/^year\s+(\d)$/);
  if (year) return [`year ${year[1]}`];

  // Fallback: keep raw token so unusual labels still self-match
  return [s];
}

/**
 * Parse any human grade label into a normalized set of atoms.
 * Handles combined labels split on `/`, `•`, `·`, `,`, `&`.
 */
export function expandGradeTokens(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const parts = String(raw)
    .split(/[\/•·,&]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) {
    for (const atom of expandSingleToken(p)) out.add(atom);
  }
  return Array.from(out);
}

/** True if any of the resource's grade labels overlaps the learner's grade. */
export function gradeMatches(
  resourceGradeLabels: Array<string | null | undefined> | null | undefined,
  learnerGrade: string | null | undefined,
): boolean {
  if (!learnerGrade) return true; // tag-tolerant
  const labels = (resourceGradeLabels || []).filter(Boolean) as string[];
  if (labels.length === 0) return true; // untagged resource visible to all
  const learnerAtoms = new Set(expandGradeTokens(learnerGrade));
  if (learnerAtoms.size === 0) return true;
  for (const l of labels) {
    const atoms = expandGradeTokens(l);
    if (atoms.includes("*")) return true;
    if (atoms.some((a) => learnerAtoms.has(a))) return true;
  }
  return false;
}

// ─── Subject matching ─────────────────────────────────────────────────────
// Canonicalize: lowercase, strip parentheticals, collapse spaces.
function canonicalSubject(s: string | null | undefined): string {
  return norm(s).replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
}

// Common cross-curriculum aliases. Each group is treated as the same subject.
const SUBJECT_ALIAS_GROUPS: string[][] = [
  ["mathematics", "maths", "math", "pure mathematics", "core mathematics", "additional mathematics", "add maths"],
  ["mathematical literacy", "maths literacy", "math literacy", "maths lit"],
  ["physics", "physical sciences", "physical science"],
  ["chemistry"],
  ["biology", "life sciences", "life science"],
  ["combined science", "integrated science", "natural sciences", "natural science", "general science", "science"],
  ["accounting", "accountancy", "principles of accounts", "financial accounting"],
  ["business studies", "business management", "business"],
  ["economics", "economic management sciences", "ems"],
  ["english", "english home language", "english first additional language", "english language", "english fal", "english hl"],
  ["literature in english", "english literature"],
  ["history"],
  ["geography"],
  ["computer science", "computing", "information technology", "it", "computers"],
  ["agriculture", "agricultural science", "agricultural sciences"],
  ["religious studies", "religious education", "divinity", "bible knowledge"],
  ["shona", "ndebele", "isizulu", "isixhosa", "afrikaans"], // keep separate? grouping for indigenous langs is wrong; leaving each alone
];

const SUBJECT_TO_CANONICAL = (() => {
  const m = new Map<string, string>();
  for (const group of SUBJECT_ALIAS_GROUPS) {
    const canon = group[0];
    for (const alias of group) m.set(alias, canon);
  }
  return m;
})();

function subjectKey(s: string | null | undefined): string {
  const c = canonicalSubject(s);
  return SUBJECT_TO_CANONICAL.get(c) ?? c;
}

export function subjectMatches(
  resourceSubject: string | null | undefined,
  learnerSubjects: string[] | null | undefined,
): boolean {
  if (!learnerSubjects?.length) return false;
  const r = subjectKey(resourceSubject);
  if (!r) return false;
  return learnerSubjects.some((s) => subjectKey(s) === r);
}

/** Returns the count of learner subjects that overlap any of the resource subjects. */
export function subjectOverlapCount(
  resourceSubjects: Array<string | null | undefined> | null | undefined,
  learnerSubjects: string[] | null | undefined,
): number {
  if (!learnerSubjects?.length || !resourceSubjects?.length) return 0;
  const learnerKeys = new Set(learnerSubjects.map(subjectKey).filter(Boolean));
  const resourceKeys = new Set(resourceSubjects.map(subjectKey).filter(Boolean));
  let n = 0;
  for (const k of resourceKeys) if (learnerKeys.has(k)) n++;
  return n;
}
