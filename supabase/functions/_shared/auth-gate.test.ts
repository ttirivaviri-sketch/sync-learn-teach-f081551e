// End-to-end auth-gate tests for the hardened edge functions.
// Verifies that AI generation, lesson processing, payout and the removed
// migration endpoint all reject unauthenticated / forged callers.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

assert(SUPABASE_URL, "VITE_SUPABASE_URL missing from .env");
assert(ANON_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY missing from .env");

// A syntactically valid but unsigned/forged JWT claiming an arbitrary user id.
const FORGED_JWT = [
  btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  btoa(JSON.stringify({
    sub: "00000000-0000-0000-0000-000000000001",
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })),
  "not-a-real-signature",
].join(".").replace(/=/g, "");

const AI_FUNCTIONS = [
  "generate-topic-session",
  "generate-concept-review",
  "map-question-concepts",
  "evaluate-topic-answer",
  "generate-daily-task",
  "grade-answer",
  "generate-progress-plan",
  "render-question-visual",
  "analyze-prerequisites",
  "generate-prerequisite-quiz",
  "generate-prerequisite-theory",
  "transcribe-lesson-chunk",
  "seed-curriculum-topics",
];

const LESSON_FUNCTIONS = [
  "generate-lesson-reinforcement",
  "process-lesson-recording",
];

type CallOpts = { authorization?: string; body?: unknown };

async function callFunction(name: string, opts: CallOpts = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
  };
  if (opts.authorization) headers.Authorization = opts.authorization;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body ?? {}),
  });
  const text = await res.text(); // always consume the body
  return { status: res.status, text };
}

function assertRejected(name: string, status: number, text: string, scenario: string) {
  assert(
    status === 401 || status === 403,
    `${name} (${scenario}) should reject with 401/403 but returned ${status}: ${text.slice(0, 300)}`,
  );
}

for (const fn of AI_FUNCTIONS) {
  Deno.test(`${fn} rejects anonymous callers`, async () => {
    const { status, text } = await callFunction(fn);
    assertRejected(fn, status, text, "no Authorization header");
  });

  Deno.test(`${fn} rejects forged JWTs`, async () => {
    const { status, text } = await callFunction(fn, { authorization: `Bearer ${FORGED_JWT}` });
    assertRejected(fn, status, text, "forged JWT");
  });
}

for (const fn of LESSON_FUNCTIONS) {
  Deno.test(`${fn} rejects anonymous callers`, async () => {
    const { status, text } = await callFunction(fn, {
      body: { recordingId: "00000000-0000-0000-0000-000000000002" },
    });
    assertRejected(fn, status, text, "no Authorization header");
  });

  Deno.test(`${fn} rejects forged JWTs`, async () => {
    const { status, text } = await callFunction(fn, {
      authorization: `Bearer ${FORGED_JWT}`,
      body: { recordingId: "00000000-0000-0000-0000-000000000002" },
    });
    assertRejected(fn, status, text, "forged JWT");
  });
}

Deno.test("process-tutor-payout rejects anonymous callers", async () => {
  const { status, text } = await callFunction("process-tutor-payout", {
    body: { tutor_id: "00000000-0000-0000-0000-000000000003", amount: 100 },
  });
  assertRejected("process-tutor-payout", status, text, "no Authorization header");
});

Deno.test("process-tutor-payout rejects forged JWTs", async () => {
  const { status, text } = await callFunction("process-tutor-payout", {
    authorization: `Bearer ${FORGED_JWT}`,
    body: { tutor_id: "00000000-0000-0000-0000-000000000003", amount: 100 },
  });
  assertRejected("process-tutor-payout", status, text, "forged JWT");
});

Deno.test("run-migration endpoint no longer exists", async () => {
  const { status, text } = await callFunction("run-migration", {
    body: { sql: "select 1" },
  });
  assert(
    status === 404 || status === 401 || status === 403,
    `run-migration should be gone (404) or blocked, got ${status}: ${text.slice(0, 200)}`,
  );
  assert(
    !text.includes("migration applied"),
    "run-migration must not execute SQL",
  );
  assertEquals(text.includes("rows"), false);
});
