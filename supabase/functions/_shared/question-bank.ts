/**
 * Question-bank pooling — shared across generate-quiz / generate-exam-questions.
 *
 * Flow (inside a generator):
 *   1. `drawFromPool()` — fetch up to `count` pool questions matching the
 *      curriculum/subject/topic key, EXCLUDING any fingerprint the calling
 *      user has already seen (question_fingerprints). Pool hits skip the AI
 *      call entirely for that slot.
 *   2. Generator calls the AI only for the shortfall.
 *   3. `contributeToPool()` — persist validator-clean fresh questions so the
 *      next student on the same syllabus gets them for free.
 *
 * Gated by QUESTION_BANK_ENABLED (default off), mirroring the novelty
 * engine's rollout pattern. When disabled both functions are no-ops, so the
 * generators behave exactly as before.
 *
 * The pool stores ANONYMOUS study content only — no user ids. Per-user
 * dedupe lives in question_fingerprints, which the novelty engine already
 * maintains; serving a pool question registers a fingerprint for that user
 * so they can never receive it twice.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fingerprintStem } from "./provenance.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const QUESTION_BANK_ENABLED =
  (Deno.env.get("QUESTION_BANK_ENABLED") ?? "false").toLowerCase() === "true";

/** Cap how many rows we scan per draw — keeps the query cheap. */
const POOL_SCAN_LIMIT = 60;

export interface PoolKey {
  curriculum?: string | null;
  subject: string;
  topic: string;
  examLevel?: string | null;
  difficulty?: string | null;
  /** 'quiz' | 'exam_questions' */
  surface: string;
}

export interface PoolTargeting {
  /**
   * Weak areas / concepts the request is targeting. When present, only pool
   * questions whose stored `concepts` intersect these are served — the pool
   * must honour the same depth-level targeting the AI prompt receives, or
   * personalised requests would silently get generic questions.
   */
  targetConcepts?: string[];
  /** Preferred question type (e.g. "multiple_choice") — hard filter when set. */
  preferredQuestionType?: string;
}

export interface PoolQuestion {
  /** question_bank.id — used for the served-count bump. */
  bankId: string;
  fingerprint: string;
  /** The stored normalised question object. */
  payload: Record<string, unknown>;
}

function svc() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

/**
 * Draw up to `count` questions from the pool for this key, excluding
 * fingerprints the user has already seen. Never throws — pooling failures
 * must never break generation.
 */
export async function drawFromPool(opts: {
  key: PoolKey;
  count: number;
  userId?: string | null;
  targeting?: PoolTargeting;
}): Promise<PoolQuestion[]> {
  if (!QUESTION_BANK_ENABLED || opts.count <= 0) return [];
  try {
    const client = svc();
    const { key } = opts;
    const targetConcepts = (opts.targeting?.targetConcepts ?? [])
      .map(norm)
      .filter(Boolean);

    let q = client
      .from("question_bank")
      .select("id,fingerprint,payload,question_type,concepts")
      .eq("subject", norm(key.subject))
      .eq("topic", norm(key.topic))
      .eq("surface", key.surface)
      .order("times_served", { ascending: true }) // spread load across the pool
      .limit(POOL_SCAN_LIMIT);

    if (key.curriculum) q = q.eq("curriculum", norm(key.curriculum));
    if (key.examLevel) q = q.eq("exam_level", norm(key.examLevel));
    if (key.difficulty) q = q.eq("difficulty", norm(key.difficulty));
    if (opts.targeting?.preferredQuestionType) {
      q = q.eq("question_type", opts.targeting.preferredQuestionType);
    }
    // Concept-level targeting: overlap on the GIN-indexed concepts column.
    if (targetConcepts.length > 0) {
      q = q.overlaps("concepts", targetConcepts);
    }

    const { data: rows, error } = await q;
    if (error || !rows || rows.length === 0) return [];

    // Exclude anything this user has already seen.
    let seen = new Set<string>();
    if (opts.userId) {
      const { data: fps } = await client
        .from("question_fingerprints")
        .select("fingerprint")
        .eq("user_id", opts.userId)
        .in("fingerprint", rows.map((r: { fingerprint: string }) => r.fingerprint));
      seen = new Set((fps ?? []).map((f: { fingerprint: string }) => f.fingerprint));
    }

    const picks = rows
      .filter((r: { fingerprint: string }) => !seen.has(r.fingerprint))
      .slice(0, opts.count)
      .map((r: { id: string; fingerprint: string; payload: Record<string, unknown> }) => ({
        bankId: r.id,
        fingerprint: r.fingerprint,
        payload: r.payload,
      }));

    if (picks.length > 0) {
      // Register fingerprints so the user never sees these again, and bump
      // served counters. Both best-effort.
      if (opts.userId) {
        await client.from("question_fingerprints").upsert(
          picks.map((p) => ({
            user_id: opts.userId,
            fingerprint: p.fingerprint,
            surface: key.surface,
            subject_name: norm(key.subject),
            stem_preview: String((p.payload as { question?: string }).question ?? "").slice(0, 200),
            seen_at: new Date().toISOString(),
          })),
          { onConflict: "user_id,fingerprint" },
        );
      }
      await client.rpc("bump_question_bank_served", { p_ids: picks.map((p) => p.bankId) });
    }

    return picks;
  } catch (err) {
    console.warn("[question-bank] draw failed", (err as Error)?.message);
    return [];
  }
}

/**
 * Contribute freshly generated, validator-clean questions to the pool.
 * Fire-and-forget: never throws, duplicate fingerprints are ignored.
 */
export async function contributeToPool(opts: {
  key: PoolKey;
  questions: Array<Record<string, unknown>>;
  /** Blocking validator errors — if non-empty, contribute nothing. */
  validatorErrors?: string[];
}): Promise<void> {
  if (!QUESTION_BANK_ENABLED) return;
  if (opts.validatorErrors && opts.validatorErrors.length > 0) return;
  try {
    const client = svc();
    const { key } = opts;

    const rows = [];
    for (const q of opts.questions) {
      const text = String((q as { question?: string }).question ?? "").trim();
      if (!text) continue;
      // Strip per-user novelty metadata before storing anonymously.
      const { novelty: _novelty, ...payload } = q as Record<string, unknown> & { novelty?: unknown };
      // Granular concepts this question tests — lets future draws match the
      // same depth-level targeting (weak areas) the AI prompt receives.
      const concepts = Array.isArray((q as { conceptsTested?: unknown[] }).conceptsTested)
        ? ((q as { conceptsTested: unknown[] }).conceptsTested)
            .map((c) => norm(c))
            .filter(Boolean)
            .slice(0, 12)
        : [];
      rows.push({
        fingerprint: await fingerprintStem(text),
        curriculum: norm(key.curriculum),
        subject: norm(key.subject),
        topic: norm(key.topic),
        exam_level: norm(key.examLevel),
        difficulty: norm((q as { difficulty?: string }).difficulty ?? key.difficulty ?? "medium"),
        question_type: (q as { questionType?: string }).questionType ?? null,
        surface: key.surface,
        marks: Number((q as { marks?: number }).marks) || null,
        concepts,
        payload,
      });
    }
    if (rows.length === 0) return;

    await client
      .from("question_bank")
      .upsert(rows, { onConflict: "fingerprint", ignoreDuplicates: true });
  } catch (err) {
    console.warn("[question-bank] contribute failed", (err as Error)?.message);
  }
}
