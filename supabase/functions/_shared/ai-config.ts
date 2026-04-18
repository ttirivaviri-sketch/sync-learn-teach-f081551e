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

export function getAIConfig(): AIConfig {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const openaiBase =
    Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (openaiKey) {
    return {
      url: `${openaiBase}/chat/completions`,
      key: openaiKey,
      model: Deno.env.get("AI_MODEL") || "gpt-4o-mini",
    };
  }
  if (lovableKey) {
    return {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovableKey,
      model: "google/gemini-3-flash-preview",
    };
  }
  throw new Error(
    "No AI API key configured. Set OPENAI_API_KEY or LOVABLE_API_KEY in Supabase secrets."
  );
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

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.substring(0, maxLen) + "…" : s;
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
    if (options.maxTokens) body.max_tokens = options.maxTokens;
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
  options: { temperature?: number } = {}
): Promise<Response> {
  // Enforce no-HTML rule for streaming responses (can't retry after stream starts)
  const enforcedSystemPrompt = systemPrompt.includes("Do NOT return HTML")
    ? systemPrompt
    : systemPrompt + `\n\nREMINDER: Return ONLY structured study content (markdown or plain text). Do NOT return HTML, CSS, JavaScript, JSX, or any code.`;

  const body: Record<string, unknown> = {
    model: ai.model,
    messages: [
      { role: "system", content: enforcedSystemPrompt },
      { role: "user", content: userPrompt },
    ],
    stream: true,
  };

  if (options.temperature !== undefined) body.temperature = options.temperature;

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
    console.error("AI stream error:", response.status, errText);
    throw new Error(`AI stream error: ${response.status}`);
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
