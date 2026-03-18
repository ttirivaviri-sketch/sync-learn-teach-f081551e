/**
 * aiClient.ts
 *
 * Unified AI request helper for StudyMode.
 *
 * Priority:
 *   1. Supabase Edge Function  (works in production)
 *   2. Local AI proxy /api/ai/ (works in development via Vite proxy → ai-server.js)
 *
 * Edge function names mirror the local endpoint paths:
 *   /api/ai/generate-quiz          →  edge function "generate-quiz"
 *   /api/ai/generate-task-content  →  edge function "generate-task-content"
 *   /api/ai/explain-answer         →  edge function "explain-answer"
 *   /api/ai/tutor                  →  edge function "ai-tutor"
 *   /api/ai/greeting               →  edge function "ai-greeting"
 *   /api/ai/parse-document         →  edge function "parse-document"
 *   /api/ai/progress-insights      →  edge function "progress-insights"
 *   /api/ai/detect-weak-topics     →  edge function "detect-weak-topics"
 *   /api/ai/daily-summary          →  edge function "daily-summary"
 *   /api/ai/streak-celebration     →  edge function "streak-celebration"
 *   /api/ai/analyze-prerequisites  →  edge function "analyze-prerequisites"
 *   /api/ai/generate-prerequisite-theory  →  edge function "generate-prerequisite-theory"
 *   /api/ai/generate-prerequisite-quiz   →  edge function "generate-prerequisite-quiz"
 */

import { supabase } from '../../integrations/supabase/client';

/** Map from local /api/ai/<path> segment to edge function name */
const EDGE_FUNCTION_MAP: Record<string, string> = {
  'generate-quiz':               'generate-quiz',
  'generate-task-content':       'generate-task-content',
  'explain-answer':              'explain-answer',
  'tutor':                       'ai-tutor',
  'greeting':                    'ai-greeting',
  'parse-document':              'parse-document',
  'progress-insights':           'progress-insights',
  'detect-weak-topics':          'detect-weak-topics',
  'daily-summary':               'daily-summary',
  'streak-celebration':          'streak-celebration',
  'analyze-prerequisites':       'analyze-prerequisites',
  'generate-prerequisite-theory':'generate-prerequisite-theory',
  'generate-prerequisite-quiz':  'generate-prerequisite-quiz',
  // Adaptive learning engine
  'generate-study-plan':         'generate-study-plan',
  'generate-flashcards':         'generate-flashcards',
};

/**
 * Determine if we are in a local dev environment where ai-server.js is
 * accessible via the Vite proxy.
 */
function isDevEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Invoke a Supabase Edge Function and return its Response.
 * Returns null if the edge function name is unknown.
 */
async function invokeEdgeFunction(
  endpointPath: string,
  body: unknown,
): Promise<Response | null> {
  const fnName = EDGE_FUNCTION_MAP[endpointPath];
  if (!fnName) return null;

  try {
    // supabase.functions.invoke returns { data, error }; we need the raw
    // Response for streaming support, so we build the URL ourselves and
    // use fetch with the Supabase anon key.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const supabaseUrl = (supabase as any).supabaseUrl as string | undefined
      ?? import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!supabaseUrl) return null;

    const anonKey = (supabase as any).supabaseKey as string | undefined
      ?? import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!anonKey) return null;

    const edgeUrl = `${supabaseUrl}/functions/v1/${fnName}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': anonKey,
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    } else {
      headers['Authorization'] = `Bearer ${anonKey}`;
    }

    const resp = await fetch(edgeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    return resp;
  } catch (err) {
    console.warn(`[aiClient] Edge function "${fnName}" unavailable:`, err);
    return null;
  }
}

/**
 * POST to the local /api/ai/<endpointPath> proxy.
 */
async function invokeLocalProxy(
  endpointPath: string,
  body: unknown,
): Promise<Response> {
  return fetch(`/api/ai/${endpointPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Main entry point.
 *
 * Tries the Supabase Edge Function first (production path).
 * Falls back to the local /api/ai/ proxy (dev path).
 *
 * @param endpointPath  - The segment after /api/ai/  (e.g. "generate-quiz")
 * @param body          - JSON-serialisable request body
 * @returns             - The raw Response (may be a stream)
 */
export async function aiRequest(
  endpointPath: string,
  body: unknown,
): Promise<Response> {
  // In development we can skip the edge-function round-trip and go directly
  // to the local proxy for speed, but we still try edge functions so that
  // developers can test the production path by setting
  // VITE_FORCE_EDGE_FUNCTIONS=true.
  const forceEdge =
    typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.VITE_FORCE_EDGE_FUNCTIONS === 'true';

  if (!isDevEnvironment() || forceEdge) {
    const edgeResp = await invokeEdgeFunction(endpointPath, body);
    if (edgeResp !== null) {
      // If edge function returns a non-5xx response, use it.
      if (edgeResp.ok || (edgeResp.status >= 400 && edgeResp.status < 500)) {
        return edgeResp;
      }
      console.warn(
        `[aiClient] Edge function returned ${edgeResp.status}; falling back to local proxy`,
      );
    }
  }

  // Development fallback (or edge function unavailable)
  return invokeLocalProxy(endpointPath, body);
}

/**
 * Convenience helper: POST and parse JSON response (non-streaming).
 */
export async function aiRequestJSON<T = unknown>(
  endpointPath: string,
  body: unknown,
): Promise<T> {
  const resp = await aiRequest(endpointPath, body);
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error(
      (errData as any).error || `AI request failed with status ${resp.status}`,
    );
  }
  return resp.json() as Promise<T>;
}
