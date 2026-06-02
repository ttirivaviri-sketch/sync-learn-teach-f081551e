/**
 * Novelty engine — Phase 4
 *
 * Two layers:
 *   1. Exact fingerprint     — SHA-256 of a normalised question stem
 *   2. Semantic similarity   — cosine distance against last 200 embeddings
 *
 * Behind `NOVELTY_ENGINE_ENABLED` env flag. When disabled, every check
 * returns `{ ok: true, reason: "unverified" }` and no persistence happens.
 *
 * Used by all JSON generators to filter duplicate stems before persisting
 * the artifact and the fingerprint.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fingerprintStem, normaliseStem } from "./provenance.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

export const NOVELTY_ENABLED =
  (Deno.env.get("NOVELTY_ENGINE_ENABLED") ?? "false").toLowerCase() === "true";

const SIMILARITY_THRESHOLD = 0.92; // cosine sim — reject if > this
const RECENT_WINDOW = 200;
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export type NoveltyOutcome =
  | { ok: true; reason: "fresh" | "unverified"; fingerprint: string; embedding?: number[] }
  | { ok: false; reason: "exact_duplicate" | "semantic_duplicate"; fingerprint: string; embedding?: number[] };

interface CheckOpts {
  userId?: string | null;
  subjectId?: string | null;
  surface: string;
  questionText: string;
  /** In-batch fingerprints already accepted in this generation call. */
  inBatch?: Set<string>;
}

function svc() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/** Get an embedding via the Lovable AI Gateway. */
async function embed(text: string): Promise<number[] | null> {
  if (!LOVABLE_API_KEY) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "novelty-engine",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, 4000) }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

/**
 * Check whether a question stem is novel for the given user / surface.
 * Always returns a fingerprint so callers can persist it on accept.
 */
export async function checkNovelty(opts: CheckOpts): Promise<NoveltyOutcome> {
  const fingerprint = await fingerprintStem(opts.questionText);

  if (!NOVELTY_ENABLED || !opts.userId) {
    return { ok: true, reason: "unverified", fingerprint };
  }

  // In-batch dedupe
  if (opts.inBatch?.has(fingerprint)) {
    return { ok: false, reason: "exact_duplicate", fingerprint };
  }

  const client = svc();

  // Layer 1 — exact match
  try {
    const { data } = await client
      .from("question_fingerprints")
      .select("id")
      .eq("user_id", opts.userId)
      .eq("fingerprint", fingerprint)
      .maybeSingle();
    if (data) return { ok: false, reason: "exact_duplicate", fingerprint };
  } catch {
    // table missing or other transient — degrade gracefully
  }

  // Layer 2 — semantic match (only if we can embed)
  let embedding: number[] | null = null;
  try {
    embedding = await embed(opts.questionText);
    if (embedding && embedding.length > 0) {
      const { data: recent } = await client
        .from("question_fingerprints")
        .select("embedding")
        .eq("user_id", opts.userId)
        .order("seen_at", { ascending: false })
        .limit(RECENT_WINDOW);

      for (const row of recent ?? []) {
        const other = (row as any).embedding as number[] | null;
        if (!Array.isArray(other) || other.length !== embedding.length) continue;
        if (cosine(embedding, other) > SIMILARITY_THRESHOLD) {
          return { ok: false, reason: "semantic_duplicate", fingerprint, embedding };
        }
      }
    }
  } catch {
    // ignore — semantic layer is best-effort
  }

  return { ok: true, reason: "fresh", fingerprint, embedding: embedding ?? undefined };
}

/** Persist accepted fingerprint + embedding. Best-effort, never throws. */
export async function persistFingerprint(opts: {
  userId: string;
  subjectId?: string | null;
  surface: string;
  fingerprint: string;
  stemPreview: string;
  embedding?: number[];
}): Promise<void> {
  if (!NOVELTY_ENABLED) return;
  try {
    const client = svc();
    await client.from("question_fingerprints").upsert(
      {
        user_id: opts.userId,
        subject_id: opts.subjectId ?? null,
        fingerprint: opts.fingerprint,
        surface: opts.surface,
        stem_preview: opts.stemPreview.slice(0, 200),
        embedding: opts.embedding ?? null,
        seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,fingerprint" },
    );
  } catch (err) {
    console.warn("[novelty] persist failed", (err as Error)?.message);
  }
}

export { normaliseStem };
