/**
 * Curriculum template bulk-import — pure parsing & validation.
 *
 * Admins paste (or upload) JSON describing verified topic trees; this module
 * validates the payload client-side before anything touches the database.
 * Accepted shapes:
 *   1. A single template object            { curriculum, grade, subject, topics }
 *   2. An array of template objects        [ {...}, {...} ]
 *   3. A wrapper object                    { templates: [ {...} ] }
 *
 * Each topic node mirrors the shape used by the verified seed migration and
 * `seed-curriculum-topics` — extra keys are additive-safe for all consumers,
 * but only the known keys below are kept so the stored payload stays clean.
 */

export const KNOWN_CURRICULA = ["ZIMSEC", "CAMB", "IEB", "NSC", "OTHER"] as const;

export interface TopicNode {
  name: string;
  subtopics: string[];
  learning_objectives: string[];
  key_concepts: string[];
  assessment_objectives: string[];
  typical_question_styles: string[];
  exam_weight?: number;
  prerequisites: string[];
  common_misconceptions: string[];
  exemplar_question_stems: string[];
}

export interface CurriculumTemplateImport {
  curriculum: string;
  grade: string;
  subject: string;
  topics: TopicNode[];
}

export interface ImportIssue {
  /** Human-readable location, e.g. "templates[0].topics[2].name" */
  path: string;
  message: string;
}

export interface ParseResult {
  templates: CurriculumTemplateImport[];
  issues: ImportIssue[];
}

const STRING_ARRAY_KEYS = [
  "subtopics",
  "learning_objectives",
  "key_concepts",
  "assessment_objectives",
  "typical_question_styles",
  "prerequisites",
  "common_misconceptions",
  "exemplar_question_stems",
] as const;

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function validateTopic(
  raw: unknown,
  path: string,
  issues: ImportIssue[],
): TopicNode | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    issues.push({ path, message: "Topic must be an object" });
    return null;
  }
  const t = raw as Record<string, unknown>;
  const name = typeof t.name === "string" ? t.name.trim() : "";
  if (!name) {
    issues.push({ path: `${path}.name`, message: "Topic name is required" });
    return null;
  }

  const node: TopicNode = {
    name,
    subtopics: [],
    learning_objectives: [],
    key_concepts: [],
    assessment_objectives: [],
    typical_question_styles: [],
    prerequisites: [],
    common_misconceptions: [],
    exemplar_question_stems: [],
  };
  for (const key of STRING_ARRAY_KEYS) {
    if (t[key] !== undefined && !Array.isArray(t[key])) {
      issues.push({ path: `${path}.${key}`, message: "Must be an array of strings" });
      return null;
    }
    node[key] = cleanStringArray(t[key]);
  }

  if (t.exam_weight !== undefined) {
    const w = Number(t.exam_weight);
    if (!Number.isFinite(w) || w < 0 || w > 100) {
      issues.push({
        path: `${path}.exam_weight`,
        message: "exam_weight must be a number between 0 and 100",
      });
      return null;
    }
    node.exam_weight = w;
  }
  return node;
}

function validateTemplate(
  raw: unknown,
  path: string,
  issues: ImportIssue[],
): CurriculumTemplateImport | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    issues.push({ path, message: "Template must be an object" });
    return null;
  }
  const t = raw as Record<string, unknown>;
  const curriculum =
    typeof t.curriculum === "string" ? t.curriculum.trim().toUpperCase() : "";
  const grade = typeof t.grade === "string" ? t.grade.trim() : "";
  const subject = typeof t.subject === "string" ? t.subject.trim() : "";

  let ok = true;
  if (!curriculum) {
    issues.push({ path: `${path}.curriculum`, message: "curriculum is required" });
    ok = false;
  } else if (!(KNOWN_CURRICULA as readonly string[]).includes(curriculum)) {
    issues.push({
      path: `${path}.curriculum`,
      message: `Unknown curriculum "${curriculum}" — expected one of ${KNOWN_CURRICULA.join(", ")}`,
    });
    ok = false;
  }
  if (!grade) {
    issues.push({ path: `${path}.grade`, message: "grade is required" });
    ok = false;
  }
  if (!subject) {
    issues.push({ path: `${path}.subject`, message: "subject is required" });
    ok = false;
  }
  if (!Array.isArray(t.topics) || t.topics.length === 0) {
    issues.push({
      path: `${path}.topics`,
      message: "topics must be a non-empty array",
    });
    return null;
  }
  if (!ok) return null;

  const topics: TopicNode[] = [];
  const seenNames = new Set<string>();
  for (let i = 0; i < t.topics.length; i++) {
    const node = validateTopic(t.topics[i], `${path}.topics[${i}]`, issues);
    if (!node) return null;
    const lower = node.name.toLowerCase();
    if (seenNames.has(lower)) {
      issues.push({
        path: `${path}.topics[${i}].name`,
        message: `Duplicate topic name "${node.name}"`,
      });
      return null;
    }
    seenNames.add(lower);
    topics.push(node);
  }

  return { curriculum, grade, subject, topics };
}

/**
 * Parse raw import text into validated curriculum templates.
 * Never throws — all problems come back as `issues`.
 * A non-empty `issues` array means the import must not proceed.
 */
export function parseCurriculumImport(text: string): ParseResult {
  const issues: ImportIssue[] = [];
  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    return { templates: [], issues: [{ path: "$", message: "Input is empty" }] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return {
      templates: [],
      issues: [
        {
          path: "$",
          message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
        },
      ],
    };
  }

  let rawList: unknown[];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (
    typeof parsed === "object" &&
    parsed !== null &&
    Array.isArray((parsed as Record<string, unknown>).templates)
  ) {
    rawList = (parsed as Record<string, unknown>).templates as unknown[];
  } else {
    rawList = [parsed];
  }

  if (rawList.length === 0) {
    return {
      templates: [],
      issues: [{ path: "$", message: "No templates found in input" }],
    };
  }

  const templates: CurriculumTemplateImport[] = [];
  const seenCombos = new Set<string>();
  for (let i = 0; i < rawList.length; i++) {
    const tpl = validateTemplate(rawList[i], `templates[${i}]`, issues);
    if (!tpl) continue;
    const combo = `${tpl.curriculum}|${tpl.grade.toLowerCase()}|${tpl.subject.toLowerCase()}`;
    if (seenCombos.has(combo)) {
      issues.push({
        path: `templates[${i}]`,
        message: `Duplicate combination ${tpl.curriculum} / ${tpl.grade} / ${tpl.subject} in this import`,
      });
      continue;
    }
    seenCombos.add(combo);
    templates.push(tpl);
  }

  return { templates, issues };
}

/** One-line summary used in the admin preview list. */
export function summarizeTemplate(t: CurriculumTemplateImport): string {
  const stems = t.topics.reduce(
    (n, topic) => n + topic.exemplar_question_stems.length,
    0,
  );
  return `${t.curriculum} · ${t.grade} · ${t.subject} — ${t.topics.length} topics, ${stems} exemplar stems`;
}
