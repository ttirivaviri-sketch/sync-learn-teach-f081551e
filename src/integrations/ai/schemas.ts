/**
 * Client-side re-export of AI generator schemas.
 *
 * Edge functions and the client share these Zod schemas so the shape of
 * generated artifacts is single-sourced. Import from here in React code
 * rather than redefining types locally.
 *
 * NOTE: Keep this file in sync with
 *   supabase/functions/_shared/schemas/index.ts
 */

import { z } from "zod";

// ─── Primitives ───────────────────────────────────────────────────────────────

export const DifficultySchema = z.enum(["foundation", "standard", "stretch"]);

export const NoveltySchema = z.object({
  fingerprint: z.string().min(8),
  reason: z.enum(["fresh", "regenerated", "cache_hit", "unverified"]),
});

// ─── Question (shared core fields) ────────────────────────────────────────────

export const BaseQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  marks: z.number().int().min(0),
  command_word: z.string().default(""),
  concept_ids: z.array(z.string().uuid()).default([]),
  syllabus_objective_refs: z.array(z.string()).default([]),
  difficulty: DifficultySchema.default("standard"),
  novelty: NoveltySchema.optional(),
  rationale: z.string().default(""),
});

// ─── Quiz ────────────────────────────────────────────────────────────────────

export const QuizQuestionSchema = BaseQuestionSchema.extend({
  questionType: z
    .enum(["multiple_choice", "short_answer", "structured"])
    .default("structured"),
  options: z.array(z.string()).optional(),
  correctOption: z.string().length(1).optional(),
  modelAnswer: z.string().default(""),
  stepByStepSolution: z.string().default(""),
  markingScheme: z.array(z.string()).default([]),
  keyPoints: z.array(z.string()).default([]),
  conceptsTested: z.array(z.string()).default([]),
  syllabusLinks: z.array(z.string()).default([]),
  explanation: z.string().default(""),
  visual: z.any().optional(),
});

export const QuizResponseSchema = z.object({
  quiz: z.array(QuizQuestionSchema).min(1),
  weak_area_focus: z.array(z.string()).default([]),
});

// ─── Flashcards ──────────────────────────────────────────────────────────────

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

// ─── Inferred types ──────────────────────────────────────────────────────────

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type QuizResponse = z.infer<typeof QuizResponseSchema>;
export type Flashcard = z.infer<typeof FlashcardSchema>;
export type FlashcardsResponse = z.infer<typeof FlashcardsResponseSchema>;
