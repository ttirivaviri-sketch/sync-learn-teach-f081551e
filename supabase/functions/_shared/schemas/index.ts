/**
 * Shared Zod schemas — Phase 3
 *
 * Every JSON-returning generator parses its AI output against one of these
 * schemas. New provenance/concept fields are optional with safe defaults so
 * legacy generators and clients remain backward compatible.
 *
 * Re-exported to the client via `src/integrations/ai/schemas.ts`.
 */

import { z } from "npm:zod@3.23.8";

// ─── Primitives ───────────────────────────────────────────────────────────────

export const DifficultySchema = z.enum(["foundation", "standard", "stretch"]);
export const LegacyDifficultySchema = z.enum(["easy", "medium", "hard", "mixed"]);

export const NoveltySchema = z.object({
  fingerprint: z.string().min(8),
  reason: z.enum(["fresh", "regenerated", "cache_hit", "unverified"]),
});

export const VisualSchema = z
  .object({
    type: z.enum(["function-graph", "data-chart", "svg-diagram", "ai-image"]),
    required: z.boolean().default(false),
    caption: z.string().optional(),
  })
  .passthrough();

// ─── Question (shared core fields) ────────────────────────────────────────────

/** Core fields every generated question MUST carry. */
export const BaseQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  marks: z.number().int().min(0),
  command_word: z.string().default(""),

  // New: required (non-empty) once concept seeding lands; today optional with
  // an empty default so old generators stay green.
  concept_ids: z.array(z.string().uuid()).default([]),
  syllabus_objective_refs: z.array(z.string()).default([]),
  difficulty: DifficultySchema.default("standard"),
  novelty: NoveltySchema.optional(),
  rationale: z.string().default(""),
});

/** Full quiz question (multiple_choice / short_answer / structured). */
export const QuizQuestionSchema = BaseQuestionSchema.extend({
  questionType: z
    .enum(["multiple_choice", "short_answer", "structured"])
    .default("structured"),
  options: z.array(z.string()).max(6).optional(),
  correctOption: z.string().length(1).optional(),
  modelAnswer: z.string().default(""),
  stepByStepSolution: z.string().default(""),
  markingScheme: z.array(z.string()).default([]),
  keyPoints: z.array(z.string()).default([]),
  conceptsTested: z.array(z.string()).default([]),
  syllabusLinks: z.array(z.string()).default([]),
  explanation: z.string().default(""),
  visual: VisualSchema.optional(),
});

export const QuizResponseSchema = z.object({
  quiz: z.array(QuizQuestionSchema).min(1),
  weak_area_focus: z.array(z.string()).default([]),
});

// ─── Flashcards ───────────────────────────────────────────────────────────────

export const FlashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  hint: z.string().nullable().default(null),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  tags: z.array(z.string()).default([]),
  conceptType: z
    .enum(["definition", "formula", "concept", "exam_prompt", "application"])
    .default("concept"),
  syllabusLink: z.string().nullable().default(null),
  concept_ids: z.array(z.string().uuid()).default([]),
  syllabus_objective_refs: z.array(z.string()).default([]),
  rationale: z.string().default(""),
  novelty: NoveltySchema.optional(),
});

export const FlashcardsResponseSchema = z.object({
  flashcards: z.array(FlashcardSchema).min(1),
  weak_area_focus: z.array(z.string()).default([]),
});

// ─── Mock paper ───────────────────────────────────────────────────────────────

export const MockPaperQuestionSchema = BaseQuestionSchema.extend({
  number: z.string().default(""),
  question_type: z
    .enum(["mcq", "structured", "free_response", "calculation"])
    .default("structured"),
  options: z.array(z.string()).optional(),
  correct_option: z.string().length(1).optional(),
  topic: z.string().default(""),
  model_answer: z.string().default(""),
  marking_scheme: z.array(z.string()).default([]),
});

export const MockPaperResponseSchema = z.object({
  paper_code: z.string(),
  subject: z.string(),
  total_marks: z.number(),
  duration_minutes: z.number(),
  instructions: z.string().default(""),
  questions: z.array(MockPaperQuestionSchema).min(1),
});

// ─── Exam questions ───────────────────────────────────────────────────────────

export const ExamQuestionSchema = QuizQuestionSchema.extend({
  questionNumber: z.string().default(""),
  parts: z.array(z.any()).optional(),
  timeAllocation: z.union([z.string(), z.number()]).nullable().default(null),
  examinerNotes: z.string().nullable().default(null),
});

export const ExamQuestionsResponseSchema = z.object({
  exam_questions: z.array(ExamQuestionSchema).min(1),
  weak_area_focus: z.array(z.string()).default([]),
  totalMarks: z.number().optional(),
  suggestedTime: z.string().optional(),
});

// ─── Prerequisite quiz (MCQ-only foundation check) ────────────────────────────

export const PrerequisiteQuestionSchema = BaseQuestionSchema.extend({
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().default(""),
});

export const PrerequisiteResponseSchema = z.object({
  questions: z.array(PrerequisiteQuestionSchema).min(1),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safe-parse a payload, attempting permissive coercion first. Returns
 * `{ data, warnings }` so callers can persist warnings into provenance and
 * keep shipping content even when the model returns a slightly off shape.
 */
export function softParse<T extends z.ZodTypeAny>(
  schema: T,
  payload: unknown,
): { data: z.infer<T> | null; warnings: string[] } {
  const warnings: string[] = [];
  const result = schema.safeParse(payload);
  if (result.success) return { data: result.data, warnings };
  for (const issue of result.error.issues.slice(0, 6)) {
    warnings.push(`${issue.path.join(".")}: ${issue.message}`);
  }
  return { data: null, warnings };
}

export type QuizResponse = z.infer<typeof QuizResponseSchema>;
export type FlashcardsResponse = z.infer<typeof FlashcardsResponseSchema>;
export type MockPaperResponse = z.infer<typeof MockPaperResponseSchema>;
export type ExamQuestionsResponse = z.infer<typeof ExamQuestionsResponseSchema>;
export type PrerequisiteResponse = z.infer<typeof PrerequisiteResponseSchema>;
