/**
 * _shared/ai-config.ts
 *
 * Shared AI configuration and prompt builder for all StudySync edge functions.
 *
 * Provides:
 *   1. getAIConfig() — picks OpenAI or Lovable gateway
 *   2. buildStudyModeContext() — assembles the unified prompt context
 *   3. STUDYMODE_SYSTEM_IDENTITY — the base system identity for all AI calls
 *   4. corsHeaders — standard CORS headers
 *   5. safeJsonParse() — robust JSON extraction from AI responses
 */

// ─── CORS ────────────────────────────────────────────────────────────────────

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, " +
    "x-supabase-client-platform, x-supabase-client-platform-version, " +
    "x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── AI Provider Selection ───────────────────────────────────────────────────

export interface AIConfig {
  url: string;
  key: string;
  model: string;
}

export type AITier = "cheap" | "standard";

/**
 * Returns AI gateway config. Pass `tier` to route by task complexity:
 *   "cheap"    → gemini-2.5-flash-lite (≈80% cheaper, for flashcards / explanations / greetings)
 *   "standard" → gemini-3-flash-preview (default, for quizzes / exams / tutor)
 */
export function getAIConfig(tier: AITier = "standard"): AIConfig {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const openaiBase =
    Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (openaiKey) {
    return {
      url: `${openaiBase}/chat/completions`,
      key: openaiKey,
      model:
        Deno.env.get("AI_MODEL") ||
        (tier === "cheap" ? "gpt-4o-mini" : "gpt-4o-mini"),
    };
  }
  if (lovableKey) {
    return {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovableKey,
      model:
        tier === "cheap"
          ? "google/gemini-2.5-flash-lite"
          : "google/gemini-3-flash-preview",
    };
  }
  throw new Error(
    "No AI API key configured. Set OPENAI_API_KEY or LOVABLE_API_KEY in Supabase secrets."
  );
}

// ─── Per-user daily quota (Moderate tier) ───────────────────────────────────

/**
 * Daily caps for the Standard ("Moderate") plan. Premium gets 3x.
 * Bucket names are stored in ai_usage_daily.bucket.
 */
export const QUOTA_BUCKETS = {
  quiz: 25,
  flashcards: 30,
  explain: 40,
  tutor: 30,
  daily_task: 3,
  mock_paper: 1,
  insights: 5,
  topic_session: 8,
  concept_review: 10,
  misc: 50,
} as const;

export type QuotaBucket = keyof typeof QUOTA_BUCKETS;

const PREMIUM_MULTIPLIER = 3;

/**
 * Extracts the caller's user id from the request's Authorization JWT (if any).
 * Returns null for anonymous / service-role calls — those bypass quota.
 */
export function getUserIdFromRequest(req: Request): string | null {
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Calls the SECURITY DEFINER function check_and_increment_ai_usage.
 * Returns { allowed, used, limit }. If the user is anonymous, always allowed.
 */
// In-memory admin cache (per cold start) to avoid re-querying has_role on every call
const ADMIN_CACHE = new Map<string, boolean>();

async function isAdminUser(
  userId: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<boolean> {
  const cached = ADMIN_CACHE.get(userId);
  if (cached !== undefined) return cached;
  try {
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/has_role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ _user_id: userId, _role: "admin" }),
    });
    if (!resp.ok) return false;
    const result = await resp.json();
    const isAdmin = result === true;
    ADMIN_CACHE.set(userId, isAdmin);
    return isAdmin;
  } catch {
    return false;
  }
}

export async function enforceQuota(
  req: Request,
  bucket: QuotaBucket,
  opts: { isPremium?: boolean; amount?: number } = {}
): Promise<{ allowed: boolean; used: number; limit: number; userId: string | null }> {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return { allowed: true, used: 0, limit: QUOTA_BUCKETS[bucket], userId: null };
  }

  const limit = QUOTA_BUCKETS[bucket] * (opts.isPremium ? PREMIUM_MULTIPLIER : 1);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    // Fail open — quota infra missing, do not block users
    return { allowed: true, used: 0, limit, userId };
  }

  // Admins bypass all AI quotas (bulk-seed, curriculum tools, etc.)
  if (await isAdminUser(userId, supabaseUrl, serviceKey)) {
    return { allowed: true, used: 0, limit, userId };
  }

  try {
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/check_and_increment_ai_usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        _user_id: userId,
        _bucket: bucket,
        _limit: limit,
        _amount: opts.amount ?? 1,
      }),
    });
    if (!resp.ok) {
      console.warn(`[enforceQuota] RPC failed ${resp.status} — failing open`);
      return { allowed: true, used: 0, limit, userId };
    }
    const data = await resp.json();
    return {
      allowed: !!data?.allowed,
      used: Number(data?.used ?? 0),
      limit: Number(data?.limit ?? limit),
      userId,
    };
  } catch (e) {
    console.warn("[enforceQuota] error — failing open:", e);
    return { allowed: true, used: 0, limit, userId };
  }
}

/**
 * Standard 429 response when the user has hit their daily AI cap.
 */
export function quotaExceededResponse(
  bucket: QuotaBucket,
  used: number,
  limit: number
): Response {
  return new Response(
    JSON.stringify({
      error: "daily_limit_reached",
      message: `You've used today's free AI for ${bucket} (${used}/${limit}). It resets at midnight, or upgrade to Premium for higher limits.`,
      bucket,
      used,
      limit,
    }),
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// ─── Shared response cache (per-bucket, content-keyed) ──────────────────────

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Build a stable cache key from fn name + canonical JSON of inputs. */
export async function buildCacheKey(fnName: string, input: unknown): Promise<string> {
  const canonical = JSON.stringify(input, Object.keys(input as object || {}).sort());
  const hash = await sha256Hex(`${fnName}::${canonical}`);
  return `${fnName}:${hash}`;
}

/** Fetch a cached response (if not expired). Fails open (returns null). */
export async function getCached<T = unknown>(cacheKey: string): Promise<T | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;
  try {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/ai_response_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=response,expires_at&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    if (!resp.ok) return null;
    const rows = await resp.json();
    const row = rows?.[0];
    if (!row) return null;
    if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
    return row.response as T;
  } catch {
    return null;
  }
}

/** Store a response in the shared cache. Fails silently. */
export async function setCached(
  cacheKey: string,
  fnName: string,
  response: unknown
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/ai_response_cache`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        cache_key: cacheKey,
        fn_name: fnName,
        response,
      }),
    });
  } catch {
    /* best-effort */
  }
}

// ─── Shared System Identity ──────────────────────────────────────────────────

export const STUDYMODE_SYSTEM_IDENTITY = `You are StudySync AI — an expert exam preparation engine designed to generate personalised, curriculum-aligned study materials that drive mastery.

CORE PRINCIPLES:
• Every output must be grounded in the provided syllabus, curriculum, and past-paper data.
• Personalise to the student: prioritise weak areas, match difficulty to their level, adapt based on past performance.
• No generic or vague questions — every item must be specific, academically accurate, and curriculum-relevant.
• Use precise subject terminology and exam command words (define, explain, evaluate, compare, calculate, justify, etc.).
• Adjust complexity only as needed — challenge without overwhelming, support without dumbing down.
• Focus on deep student understanding, not rote memorisation.
• Make content engaging, exam-focused, and supportive. Reinforce understanding and help the student improve confidence.

OUTPUT FORMAT RULES — ABSOLUTE REQUIREMENTS:
• You are a study content generator, NOT a web developer.
• Do NOT return HTML, CSS, JavaScript, JSX, TSX, or any website/application code.
• Do NOT return <html>, <div>, <head>, <body>, <script>, <style>, or any markup tags.
• Do NOT return metadata, page headers, navigation bars, or UI components.
• Return ONLY clean, structured educational study content.
• When JSON is requested, return ONLY valid JSON with no surrounding text.
• When plain text/markdown is requested, return ONLY the formatted study content.
• If your response includes HTML or code, it is INCORRECT. You must regenerate and return only structured study content.`;

// ─── Unified Context Builder ─────────────────────────────────────────────────

export interface StudyModeContextInput {
  curriculum?: string;
  subject?: string;
  topic?: string;
  examLevel?: string;
  weakAreas?: string[] | string;
  notesOrDocuments?: string;
  performanceData?: string;
  syllabusContext?: string;
  pastPaperContext?: string;
  examWeight?: number;
  subtopics?: string[];
  difficulty?: string;
  masteryStatus?: string;
}

/**
 * Builds a unified context block from all available student data.
 * Uses the template placeholders: {curriculum}, {subject}, {topic},
 * {exam_level}, {weak_areas}, {notes_or_documents}, {performance_data}.
 */
export function buildStudyModeContext(input: StudyModeContextInput): string {
  const parts: string[] = [];

  // ── Core identifiers ──────────────────────────────────────────────────────
  if (input.curriculum) parts.push(`CURRICULUM: ${input.curriculum}`);
  if (input.subject) parts.push(`SUBJECT: ${input.subject}`);
  if (input.topic) parts.push(`TOPIC: ${input.topic}`);
  if (input.examLevel) parts.push(`EXAM LEVEL: ${input.examLevel}`);

  // ── Topic details ─────────────────────────────────────────────────────────
  if (input.subtopics?.length) {
    parts.push(`SUBTOPICS: ${input.subtopics.join(", ")}`);
  }
  if (input.examWeight && input.examWeight > 0) {
    parts.push(`EXAM WEIGHT: ${input.examWeight}% of total paper marks`);
  }
  if (input.difficulty) {
    parts.push(`TARGET DIFFICULTY: ${input.difficulty}`);
  }
  if (input.masteryStatus) {
    parts.push(`STUDENT MASTERY STATUS: ${input.masteryStatus}`);
  }

  // ── Weak areas (priority) ─────────────────────────────────────────────────
  const weakAreas = Array.isArray(input.weakAreas)
    ? input.weakAreas
    : input.weakAreas
    ? [input.weakAreas]
    : [];
  if (weakAreas.length > 0) {
    parts.push(
      `\n⚠ WEAK AREAS (PRIORITISE THESE IN YOUR OUTPUT):\n${weakAreas
        .map((w) => `  • ${w}`)
        .join("\n")}`
    );
  }

  // ── Performance data ──────────────────────────────────────────────────────
  if (input.performanceData) {
    parts.push(
      `\nSTUDENT PERFORMANCE DATA:\n${truncate(input.performanceData, 1500)}`
    );
  }

  // ── Syllabus context ──────────────────────────────────────────────────────
  if (input.syllabusContext) {
    parts.push(
      `\nSYLLABUS & LEARNING OBJECTIVES:\n${truncate(input.syllabusContext, 3000)}`
    );
  }

  // ── Past paper context ────────────────────────────────────────────────────
  if (input.pastPaperContext) {
    parts.push(
      `\nPAST PAPER PATTERNS:\n${truncate(input.pastPaperContext, 2000)}`
    );
  }

  // ── Notes / documents ─────────────────────────────────────────────────────
  if (input.notesOrDocuments) {
    parts.push(
      `\nSTUDENT NOTES / UPLOADED DOCUMENTS:\n${truncate(input.notesOrDocuments, 3000)}`
    );
  }

  return parts.join("\n");
}

// ─── JSON Parsing Helpers ────────────────────────────────────────────────────

/**
 * Robustly parses JSON from an AI response.
 * Handles: raw JSON, markdown-fenced JSON, and partial extraction.
 */
export function safeJsonParse<T = unknown>(raw: string): T {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    throw new Error("AI response was empty");
  }

  const attempts: string[] = [];

  // Collect candidate strings to try parsing
  // 1. Raw input (trimmed)
  attempts.push(raw.trim());

  // 2. Extract from markdown fences
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) attempts.push(fenceMatch[1].trim());

  // 3. Extract first JSON object by brace boundaries
  const objStart = raw.indexOf("{");
  const objEnd = raw.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    attempts.push(raw.substring(objStart, objEnd + 1));
  }

  // 4. Extract JSON array
  const arrStart = raw.indexOf("[");
  const arrEnd = raw.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    attempts.push(raw.substring(arrStart, arrEnd + 1));
  }

  // 5. Truncation recovery: try to repair an unfinished object/array
  //    by truncating to the last complete element and balancing brackets.
  if (objStart !== -1) {
    attempts.push(repairTruncatedJson(raw.substring(objStart)));
  }
  if (arrStart !== -1) {
    attempts.push(repairTruncatedJson(raw.substring(arrStart)));
  }

  for (const candidate of attempts) {
    // Try direct parse
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // continue
    }

    // Try after cleaning common issues
    try {
      const cleaned = candidate
        .replace(/,\s*}/g, "}")       // trailing commas in objects
        .replace(/,\s*]/g, "]")       // trailing commas in arrays
        .replace(/[\x00-\x1F\x7F]/g, (ch) =>
          ch === "\n" || ch === "\r" || ch === "\t" ? ch : ""
        ) // strip control chars except whitespace
        .replace(/\\\n/g, "\\n");     // fix escaped newlines
      return JSON.parse(cleaned) as T;
    } catch {
      // continue
    }

    // Try after escaping invalid backslash sequences (e.g. LaTeX like \mu, \frac)
    // JSON only allows \" \\ \/ \b \f \n \r \t \uXXXX — anything else is invalid.
    try {
      const fixed = fixInvalidJsonEscapes(
        candidate
          .replace(/,\s*}/g, "}")
          .replace(/,\s*]/g, "]")
          .replace(/[\x00-\x1F\x7F]/g, (ch) =>
            ch === "\n" || ch === "\r" || ch === "\t" ? ch : ""
          )
      );
      return JSON.parse(fixed) as T;
    } catch {
      // continue
    }
  }

  console.error("[safeJsonParse] Failed. Raw snippet:", raw.substring(0, 500));
  throw new Error("Could not parse AI response as JSON");
}

/**
 * Normalises an unknown value into a string array.
 */
export function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Repairs truncated JSON by trimming back to the last complete element
 * and rebalancing braces/brackets. Best-effort — used as a last resort.
 */
function repairTruncatedJson(s: string): string {
  let str = s.trim();
  // Strip trailing partial token (after last , } ] " )
  const lastComplete = Math.max(
    str.lastIndexOf("}"),
    str.lastIndexOf("]"),
  );
  if (lastComplete === -1) return str;
  str = str.substring(0, lastComplete + 1);

  // Walk and count unclosed brackets, ignoring those inside strings
  let depthObj = 0;
  let depthArr = 0;
  let inStr = false;
  let escape = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depthObj++;
    else if (c === "}") depthObj--;
    else if (c === "[") depthArr++;
    else if (c === "]") depthArr--;
  }
  // Remove trailing comma before appending closers
  str = str.replace(/,(\s*)$/, "$1");
  while (depthArr-- > 0) str += "]";
  while (depthObj-- > 0) str += "}";
  return str;
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.substring(0, maxLen) + "…" : s;
}

/**
 * Walks a JSON-ish string and escapes backslashes that are not part of a
 * valid JSON escape sequence. This rescues AI responses that include LaTeX
 * (e.g. "$\mu$", "\frac{a}{b}") inside string values without doubling the
 * backslash, which would otherwise make JSON.parse throw.
 */
function fixInvalidJsonEscapes(input: string): string {
  let out = "";
  let inStr = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"' && (i === 0 || input[i - 1] !== "\\")) {
      inStr = !inStr;
      out += c;
      continue;
    }
    if (inStr && c === "\\") {
      const next = input[i + 1];
      // Valid JSON escapes: " \ / b f n r t u
      if (next && /["\\\/bfnrtu]/.test(next)) {
        out += c + next;
        i++;
      } else {
        // Invalid escape — double the backslash so JSON.parse accepts it.
        out += "\\\\";
      }
      continue;
    }
    out += c;
  }
  return out;
}

/**
 * Detects if AI output contains HTML/code instead of study content.
 * Returns true if the response looks like HTML/JSX/code output.
 */
function containsHTMLOrCode(text: string): boolean {
  const htmlPatterns = [
    /<html[\s>]/i,
    /<head[\s>]/i,
    /<body[\s>]/i,
    /<!DOCTYPE/i,
    /<script[\s>]/i,
    /<style[\s>]/i,
    /<div\s+class(?:Name)?=/i,
    /<\/(?:html|head|body|div|script|style)>/i,
    /import\s+(?:React|{\s*useState)/,
    /export\s+default\s+function/,
    /const\s+\w+\s*=\s*\(\)\s*=>/,
    /className="/,
  ];
  // Count matches — if 3+ patterns match, it's likely code
  let matches = 0;
  for (const pattern of htmlPatterns) {
    if (pattern.test(text)) matches++;
    if (matches >= 2) return true;
  }
  return false;
}

/**
 * Makes a non-streaming AI call and returns the parsed content string.
 * Includes a safety check to reject HTML/code responses and retry once.
 */
/**
 * Reports real token usage into ai_usage_daily / school_ai_usage_daily via
 * the record_ai_token_usage RPC. Fire-and-forget: errors are logged, never
 * thrown — usage accounting must not break generation.
 */
export function reportTokenUsage(attrib: {
  userId: string | null;
  bucket: string;
  tokensIn: number;
  tokensOut: number;
  schoolId?: string | null;
}): void {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;
  if (!attrib.userId && !attrib.schoolId) return;
  if (attrib.tokensIn <= 0 && attrib.tokensOut <= 0) return;

  fetch(`${supabaseUrl}/rest/v1/rpc/record_ai_token_usage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      _user_id: attrib.userId,
      _bucket: attrib.bucket,
      _tokens_in: Math.max(0, Math.round(attrib.tokensIn)),
      _tokens_out: Math.max(0, Math.round(attrib.tokensOut)),
      _school_id: attrib.schoolId ?? null,
    }),
  }).catch((e) => console.warn("[reportTokenUsage] failed:", e));
}

/** Token-usage attribution passed to callAI so real usage is recorded. */
export interface UsageAttribution {
  userId: string | null;
  bucket: string;
  schoolId?: string | null;
}

export async function callAI(
  ai: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  options: {
    temperature?: number;
    jsonMode?: boolean;
    tools?: unknown[];
    toolChoice?: unknown;
    maxTokens?: number;
    /** When provided, real prompt/completion tokens from the model response
     *  are recorded into ai_usage_daily / school_ai_usage_daily. */
    usage?: UsageAttribution;
  } = {}
): Promise<string> {
  const makeRequest = async (prompt: string): Promise<string> => {
    const body: Record<string, unknown> = {
      model: ai.model,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: userPrompt },
      ],
    };

    if (options.temperature !== undefined) body.temperature = options.temperature;
    // Default cap to keep cost predictable. Callers can override per task.
    body.max_tokens = options.maxTokens ?? 1500;
    if (options.jsonMode) body.response_format = { type: "json_object" };
    if (options.tools) body.tools = options.tools;
    if (options.toolChoice) body.tool_choice = options.toolChoice;

    const response = await fetch(ai.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ai.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error("RATE_LIMIT");
      if (response.status === 402) throw new Error("CREDITS_EXHAUSTED");
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();

    // Record real token usage (fire-and-forget) when attribution is supplied.
    if (options.usage && data?.usage) {
      reportTokenUsage({
        userId: options.usage.userId,
        bucket: options.usage.bucket,
        schoolId: options.usage.schoolId ?? null,
        tokensIn: Number(data.usage.prompt_tokens ?? 0),
        tokensOut: Number(data.usage.completion_tokens ?? 0),
      });
    }

    // Handle tool calls
    if (options.tools) {
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) return toolCall.function.arguments;
    }

    return data.choices?.[0]?.message?.content || "";
  };

  // First attempt
  let content = await makeRequest(systemPrompt);

  // Safety check: if AI returned HTML/code, retry with a stronger enforcement prompt
  if (containsHTMLOrCode(content)) {
    console.warn("[callAI] Detected HTML/code in AI response — retrying with enforcement prompt");
    const enforcedPrompt = systemPrompt + `\n\nCRITICAL CORRECTION: Your previous response contained HTML or code. This is WRONG. You must return ONLY structured study content (plain text, markdown, or JSON). Do NOT include any HTML tags, JSX, CSS, JavaScript, or code of any kind. Return ONLY the educational content.`;
    content = await makeRequest(enforcedPrompt);

    // If still HTML after retry, strip tags as a last resort
    if (containsHTMLOrCode(content)) {
      console.error("[callAI] AI still returned HTML/code after retry — stripping tags");
      content = content
        .replace(/<[^>]+>/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    }
  }

  return content;
}

/**
 * Makes a streaming AI call and returns the raw Response for passthrough.
 * Includes output format enforcement in the system prompt.
 */
export async function callAIStream(
  ai: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  options: {
    temperature?: number;
    /** When provided, real prompt/completion tokens are captured from the
     *  final SSE usage chunk (stream_options.include_usage) and recorded. */
    usage?: UsageAttribution;
  } = {}
): Promise<Response> {
  // Enforce no-HTML rule for streaming responses (can't retry after stream starts)
  const enforcedSystemPrompt = systemPrompt.includes("Do NOT return HTML")
    ? systemPrompt
    : systemPrompt + `\n\nREMINDER: Return ONLY structured study content (markdown or plain text). Do NOT return HTML, CSS, JavaScript, JSX, or any code.`;

  const makeBody = (withUsage: boolean): string => {
    const body: Record<string, unknown> = {
      model: ai.model,
      messages: [
        { role: "system", content: enforcedSystemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    // Ask OpenAI-compatible providers to append a final usage chunk.
    if (withUsage) body.stream_options = { include_usage: true };
    return JSON.stringify(body);
  };

  const doFetch = (withUsage: boolean): Promise<Response> =>
    fetch(ai.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ai.key}`,
        "Content-Type": "application/json",
      },
      body: makeBody(withUsage),
    });

  let wantUsage = Boolean(options.usage);
  let response = await doFetch(wantUsage);

  // Some gateways reject unknown params — retry once without stream_options.
  if (!response.ok && wantUsage && response.status === 400) {
    console.warn("[callAIStream] provider rejected stream_options — retrying without usage capture");
    wantUsage = false;
    response = await doFetch(false);
  }

  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("CREDITS_EXHAUSTED");
    const errText = await response.text();
    console.error("AI stream error:", response.status, errText);
    throw new Error(`AI stream error: ${response.status}`);
  }

  // Passthrough with a lightweight SSE scanner that reports the usage chunk.
  if (wantUsage && options.usage && response.body) {
    const attrib = options.usage;
    const decoder = new TextDecoder();
    let tail = "";
    let reported = false;
    const scanUsage = (text: string) => {
      if (reported) return;
      const lines = (tail + text).split("\n");
      tail = lines.pop() ?? "";
      for (const line of lines) {
        if (reported || !line.startsWith("data: ") || !line.includes('"usage"')) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          const u = evt?.usage;
          const tokensIn = Number(u?.prompt_tokens ?? 0);
          const tokensOut = Number(u?.completion_tokens ?? 0);
          if (tokensIn > 0 || tokensOut > 0) {
            reported = true;
            reportTokenUsage({
              userId: attrib.userId,
              bucket: attrib.bucket,
              schoolId: attrib.schoolId ?? null,
              tokensIn,
              tokensOut,
            });
          }
        } catch {
          // Partial/non-JSON data line — ignore; usage chunk is well-formed.
        }
      }
    };
    const scanner = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        try {
          scanUsage(decoder.decode(chunk, { stream: true }));
        } catch (e) {
          // Never let usage accounting break the stream.
          console.warn("[callAIStream] usage scan failed:", e);
        }
      },
      flush() {
        try {
          scanUsage("\n");
        } catch { /* noop */ }
      },
    });
    return new Response(response.body.pipeThrough(scanner), {
      status: response.status,
      headers: response.headers,
    });
  }

  return response;
}

/**
 * Standard error response builder.
 */
export function errorResponse(
  error: unknown,
  status = 500
): Response {
  const message =
    error instanceof Error ? error.message : String(error);

  // Map known error codes to HTTP status
  if (message === "RATE_LIMIT") status = 429;
  if (message === "CREDITS_EXHAUSTED") status = 402;

  return new Response(
    JSON.stringify({
      error:
        message === "RATE_LIMIT"
          ? "Rate limit exceeded. Please try again shortly."
          : message === "CREDITS_EXHAUSTED"
          ? "AI credits exhausted. Please upgrade your plan."
          : message,
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Standard JSON success response builder.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Standard streaming response wrapper.
 */
export function streamResponse(body: ReadableStream | null): Response {
  return new Response(body, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}
