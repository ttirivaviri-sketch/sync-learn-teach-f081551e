/**
 * Output Provenance — Phase 2
 *
 * Every JSON-returning AI generator stamps its output with a `generation_meta`
 * object so we can later inspect, audit and validate what the model produced
 * and *why* it produced it.
 *
 * Stored as a jsonb column (`generation_meta`) on:
 *   - daily_tasks (also mirrored into task_payload.__meta)
 *   - quiz_attempts
 *   - flashcards
 *   - mock_exam_attempts
 *   - topic_session_questions
 *
 * For streaming functions (ai-tutor, generate-task-content) the meta object is
 * emitted as a final `event: meta` SSE frame and clients that don't care
 * silently ignore it.
 */

export type NoveltyReason =
  | "fresh"
  | "regenerated"
  | "cache_hit"
  | "unverified";

export interface ProvenanceInput {
  fn_name: string;
  fn_version?: string;
  model?: string;
  prompt_hash?: string;
  generated_at?: string;
  ai_latency_ms?: number;

  // Curriculum-level grounding
  curriculum?: string;
  subject?: string;
  topic?: string;
  subtopic?: string;
  syllabus_objectives?: string[];

  // Personalisation signals
  concept_ids?: string[];
  concept_labels?: string[];
  weak_area_triggers?: string[];

  // Exam-style grounding
  paper_blueprint_id?: string;
  past_paper_style_source?: string;

  // Novelty / dedup metadata
  novelty_reason?: NoveltyReason;
  fingerprints?: string[];

  // Validator output (Phase 5)
  validator_warnings?: string[];
  validator_errors?: string[];

  // Any extra free-form context
  [key: string]: unknown;
}

export interface ProvenanceMeta extends ProvenanceInput {
  fn_name: string;
  fn_version: string;
  generated_at: string;
  novelty_reason: NoveltyReason;
  validator_warnings: string[];
}

/**
 * Build the canonical provenance meta object. Always returns a fully populated
 * envelope with safe defaults — never throws.
 */
export function buildProvenance(input: ProvenanceInput): ProvenanceMeta {
  return {
    fn_version: "1",
    generated_at: new Date().toISOString(),
    novelty_reason: "unverified",
    validator_warnings: [],
    ...input,
    fn_name: input.fn_name,
  };
}

/**
 * Compute a deterministic SHA-256 hash of a prompt (or any string) so we can
 * later trace which prompt produced which artifact without storing the full
 * text.
 */
export async function hashPrompt(prompt: string): Promise<string> {
  const data = new TextEncoder().encode(prompt);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Normalise a question stem for fingerprinting:
 *   - lowercase
 *   - strip markdown/punctuation
 *   - collapse whitespace
 *   - strip standalone numbers (so "Calculate 2x + 3 when x = 4" matches
 *     "Calculate 5x + 7 when x = 2")
 */
export function normaliseStem(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_#>\[\]()~]/g, " ")
    .replace(/\b\d+(\.\d+)?\b/g, "N")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * SHA-256 fingerprint of a normalised stem. Used by the novelty engine
 * (Phase 4) and by the validator (Phase 5).
 */
export async function fingerprintStem(text: string): Promise<string> {
  return await hashPrompt(normaliseStem(text));
}

/**
 * Convenience: attach a `__meta` envelope to any JSON artifact payload. Used
 * by daily-task style generators that already store a single jsonb payload
 * and need provenance carried inside it rather than in a sibling column.
 */
export function attachMeta<T extends Record<string, unknown>>(
  payload: T,
  meta: ProvenanceMeta
): T & { __meta: ProvenanceMeta } {
  return { ...payload, __meta: meta };
}
