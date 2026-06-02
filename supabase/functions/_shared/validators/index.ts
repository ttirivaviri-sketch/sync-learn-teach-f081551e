/**
 * Pure-function validators — Phase 5
 *
 * Run after Zod parse, before persistence. No AI calls.
 * Returns `{ ok, warnings[], blocking_errors[] }`.
 *
 * Generators that hit a blocking error retry once with the errors injected
 * back into the prompt. Persistent failure surfaces a clear error to the
 * client instead of silently shipping bad content.
 */

import { fingerprintStem } from "./provenance.ts";

export interface ValidatorReport {
  ok: boolean;
  warnings: string[];
  blocking_errors: string[];
}

interface QuestionLike {
  id?: string;
  question?: string;
  marks?: number;
  command_word?: string;
  commandWord?: string;
  concept_ids?: string[];
  syllabus_objective_refs?: string[];
  markingScheme?: string[];
  marking_scheme?: string[];
}

interface ValidateOpts {
  questions: QuestionLike[];
  /** Concept IDs that belong to the requested (subject, topic). */
  topicConceptIds?: Set<string>;
  /** Syllabus objective refs present in curriculum_topic_templates. */
  knownSyllabusRefs?: Set<string>;
  /** Allow-list of command words. Empty list disables this check. */
  allowedCommandWords?: Set<string>;
  /** Recent fingerprints from the user's last N attempts. */
  recentFingerprints?: Set<string>;
  /** Paper-level total marks (mock paper validator). */
  paperTotalMarks?: number;
}

/**
 * Validate a batch of generated questions.
 * Non-blocking issues -> warnings. Blocking issues -> blocking_errors (regen).
 */
export async function validateQuestions(opts: ValidateOpts): Promise<ValidatorReport> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const fingerprints = new Set<string>();
  let runningMarks = 0;

  for (let i = 0; i < opts.questions.length; i++) {
    const q = opts.questions[i];
    const label = q.id || `q${i + 1}`;
    const cw = (q.command_word || q.commandWord || "").toLowerCase().trim();

    // 1. Topic adherence
    if (opts.topicConceptIds && opts.topicConceptIds.size > 0 && q.concept_ids?.length) {
      const stray = q.concept_ids.filter((c) => !opts.topicConceptIds!.has(c));
      if (stray.length > 0) {
        warnings.push(`${label}: ${stray.length} concept_id(s) outside requested topic`);
      }
    }

    // 2. Syllabus mapping
    if (opts.knownSyllabusRefs && q.syllabus_objective_refs?.length) {
      const unknown = q.syllabus_objective_refs.filter(
        (r) => !opts.knownSyllabusRefs!.has(r),
      );
      if (unknown.length > 0) {
        warnings.push(`${label}: unknown syllabus refs [${unknown.join(", ")}]`);
      }
    }

    // 3. Stem repetition
    if (q.question) {
      const fp = await fingerprintStem(q.question);
      if (fingerprints.has(fp)) {
        errors.push(`${label}: duplicate stem within this batch`);
      }
      fingerprints.add(fp);
      if (opts.recentFingerprints?.has(fp)) {
        errors.push(`${label}: stem matches a recently seen question`);
      }
    }

    // 4. Mark-scheme arithmetic
    const ms = q.markingScheme ?? q.marking_scheme ?? [];
    if (Array.isArray(ms) && ms.length > 0 && typeof q.marks === "number" && q.marks > 0) {
      // Sum any "N mark(s)" mentions in marking scheme entries
      let sum = 0;
      for (const entry of ms) {
        const match = String(entry).match(/(\d+)\s*mark/i);
        if (match) sum += Number(match[1]);
      }
      // Only complain when we could parse marks AND they don't add up
      if (sum > 0 && sum !== q.marks) {
        warnings.push(`${label}: marking scheme sums to ${sum} but question carries ${q.marks} marks`);
      }
    }

    // 5. Command-word legality
    if (opts.allowedCommandWords && opts.allowedCommandWords.size > 0 && cw) {
      if (!opts.allowedCommandWords.has(cw)) {
        warnings.push(`${label}: command word "${cw}" not in allow-list`);
      }
    }

    runningMarks += Number(q.marks ?? 0);
  }

  // Paper-level total
  if (typeof opts.paperTotalMarks === "number" && opts.paperTotalMarks > 0) {
    const diff = Math.abs(runningMarks - opts.paperTotalMarks);
    if (diff > 2) {
      errors.push(
        `paper marks mismatch: questions sum to ${runningMarks}, paper declares ${opts.paperTotalMarks}`,
      );
    }
  }

  return { ok: errors.length === 0, warnings, blocking_errors: errors };
}

/** Default command-word allow-list (broad, per-subject overrides welcome). */
export const DEFAULT_COMMAND_WORDS = new Set([
  "define", "explain", "describe", "state", "calculate", "evaluate",
  "compare", "contrast", "outline", "discuss", "show", "prove", "derive",
  "find", "determine", "analyse", "analyze", "justify", "suggest",
  "identify", "list", "name", "give", "interpret", "estimate", "deduce",
  "comment", "construct", "draw", "label", "predict", "summarise", "summarize",
]);
