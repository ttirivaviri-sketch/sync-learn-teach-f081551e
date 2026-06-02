/**
 * Post-process pipeline used by every JSON generator.
 *
 *   normalised questions  ──►  Zod soft-parse  ──►  validators  ──►  novelty
 *
 * Returns the (possibly filtered) questions plus a `meta` object that
 * callers fold into their `generation_meta` envelope.
 *
 * The pipeline is deliberately non-throwing: warnings and validator output
 * are surfaced via provenance so the client can decide whether to display
 * them, while exact-duplicate questions are dropped silently.
 */

import {
  checkNovelty,
  persistFingerprint,
  NOVELTY_ENABLED,
} from "./novelty.ts";
import {
  validateQuestions,
  DEFAULT_COMMAND_WORDS,
  type ValidatorReport,
} from "./validators/index.ts";

interface PostProcessOpts<T extends { id?: string; question?: string }> {
  questions: T[];
  surface: string;
  userId?: string | null;
  subjectId?: string | null;
  topicConceptIds?: Set<string>;
  knownSyllabusRefs?: Set<string>;
  allowedCommandWords?: Set<string>;
  paperTotalMarks?: number;
}

export interface PostProcessResult<T> {
  questions: T[];
  meta: {
    validator: ValidatorReport;
    novelty: {
      enabled: boolean;
      dropped: number;
      fingerprints: string[];
    };
  };
}

export async function postProcessQuestions<
  T extends { id?: string; question?: string },
>(opts: PostProcessOpts<T>): Promise<PostProcessResult<T>> {
  // 1. Validators
  const validator = await validateQuestions({
    questions: opts.questions as any,
    topicConceptIds: opts.topicConceptIds,
    knownSyllabusRefs: opts.knownSyllabusRefs,
    allowedCommandWords: opts.allowedCommandWords ?? DEFAULT_COMMAND_WORDS,
    paperTotalMarks: opts.paperTotalMarks,
  });

  // 2. Novelty filter — only when enabled AND we have a user
  const accepted: T[] = [];
  const fingerprints: string[] = [];
  const inBatch = new Set<string>();
  let dropped = 0;

  for (const q of opts.questions) {
    const text = String(q.question ?? "");
    if (!text) {
      accepted.push(q);
      continue;
    }
    const outcome = await checkNovelty({
      userId: opts.userId,
      subjectId: opts.subjectId,
      surface: opts.surface,
      questionText: text,
      inBatch,
    });

    if (!outcome.ok) {
      dropped++;
      continue;
    }
    inBatch.add(outcome.fingerprint);
    fingerprints.push(outcome.fingerprint);
    accepted.push({ ...(q as any), novelty: { fingerprint: outcome.fingerprint, reason: outcome.reason } });

    if (opts.userId && outcome.reason === "fresh") {
      await persistFingerprint({
        userId: opts.userId,
        subjectId: opts.subjectId,
        surface: opts.surface,
        fingerprint: outcome.fingerprint,
        stemPreview: text,
        embedding: outcome.embedding,
      });
    }
  }

  // Guarantee we never return zero — fall back to original list if every
  // candidate was rejected (the client would otherwise see an empty payload).
  const finalQuestions = accepted.length > 0 ? accepted : opts.questions;

  return {
    questions: finalQuestions,
    meta: {
      validator,
      novelty: {
        enabled: NOVELTY_ENABLED,
        dropped,
        fingerprints,
      },
    },
  };
}

/** Resolve userId from an incoming request's Authorization header. */
export async function resolveUserId(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!auth) return null;
    const jwt = auth.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return null;
    // Decode JWT payload (no signature verification — Supabase already
    // validates it upstream and we only need the sub claim for keying).
    const [, payload] = jwt.split(".");
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json?.sub ?? null;
  } catch {
    return null;
  }
}
