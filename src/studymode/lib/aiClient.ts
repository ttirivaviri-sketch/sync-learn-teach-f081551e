/**
 * aiClient.ts
 *
 * Unified AI request helper for StudyMode.
 *
 * Priority:
 *   1. Supabase Edge Function  (works in production)
 *   2. Local AI proxy /api/ai/ (works in development via Vite proxy -> ai-server.js)
 *
 * Edge function names mirror the local endpoint paths:
 *   /api/ai/generate-quiz          ->  edge function "generate-quiz"
 *   /api/ai/generate-task-content  ->  edge function "generate-task-content"
 *   /api/ai/explain-answer         ->  edge function "explain-answer"
 *   /api/ai/tutor                  ->  edge function "ai-tutor"
 *   /api/ai/parse-document         ->  edge function "parse-document"
 *   /api/ai/generate-study-plan    ->  edge function "generate-study-plan"
 *   /api/ai/generate-flashcards   ->  edge function "generate-flashcards"
 *   /api/ai/generate-exam-questions ->  edge function "generate-exam-questions"
 */

import { supabase } from '../../integrations/supabase/client';
import { logger } from "@/utils/logger";
import { emitAiLimit } from "./aiLimitBus";

// ─── Known Supabase project constants ─────────────────────────────────────────
// These are public values (not secrets) — the anon key is safe to embed.
const SUPABASE_URL = 'https://uynoykcratwbcdzmsxfw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5bm95a2NyYXR3YmNkem1zeGZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNDYwMTksImV4cCI6MjA2OTYyMjAxOX0.bjshrxxGsSJNUndDl7WCvqMpN9ewEXiTVX6g5PlbXGc';

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
  // Exam-style question generator
  'generate-exam-questions':     'generate-exam-questions',
  // Mark student answer (uses explain-answer with mode=mark)
  'mark-answer':                 'explain-answer',
  // AI tracking & intelligence
  'ai-track-progress':           'ai-track-progress',
  'syllabus-enrichment':         'generate-task-content',
  'ai-study-intelligence':       'ai-study-intelligence',
  // SAIL edge functions (system-level AI prompts)
  'process-tutor-payout':        'process-tutor-payout',
  'process-video-upload':        'process-video-upload',
  'generate-student-insights':   'generate-student-insights',
  // Guardian & tutor insight functions
  'send-guardian-report':        'send-guardian-report',
  'generate-tutor-booking-insights': 'generate-tutor-booking-insights',
  // Topic Mode (flexible non-linear learning)
  'map-question-concepts':       'map-question-concepts',
  'generate-topic-session':      'generate-topic-session',
  'generate-concept-review':     'generate-concept-review',
  'evaluate-topic-answer':       'evaluate-topic-answer',
  // Syllabus-grounded structured daily task
  'generate-daily-task':         'generate-daily-task',
  // Multimodal photo-solve step grading
  'photo-solve-grade':           'photo-solve-grade',
  // Isomorphic practice variants from a graded photo-solve attempt
  'photo-solve-variants':        'photo-solve-variants',
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
 * Returns null if the edge function name is unknown or invocation fails.
 */
async function invokeEdgeFunction(
  endpointPath: string,
  body: unknown,
): Promise<Response | null> {
  const fnName = EDGE_FUNCTION_MAP[endpointPath];
  if (!fnName) return null;

  try {
    // Get current session for auth
    const { data: { session } } = await supabase.auth.getSession();

    const edgeUrl = `${SUPABASE_URL}/functions/v1/${fnName}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    } else {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    }

    const resp = await fetch(edgeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    return resp;
  } catch (err) {
    logger.warn(`[aiClient] Edge function "${fnName}" unavailable:`, err);
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

  // In production (not localhost), always try edge functions first
  if (!isDevEnvironment() || forceEdge) {
    const edgeResp = await invokeEdgeFunction(endpointPath, body);
    if (edgeResp !== null) {
      // If edge function returns a non-5xx response, use it.
      if (edgeResp.ok || (edgeResp.status >= 400 && edgeResp.status < 500)) {
        return edgeResp;
      }
      logger.warn(
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
    const errData: any = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    if (resp.status === 429 && errData?.error === 'daily_limit_reached') {
      const message = errData.message || "You've used today's free AI. It resets at midnight, or upgrade to Premium.";
      const err: any = new Error(message);
      err.code = 'daily_limit_reached';
      err.bucket = errData.bucket;
      err.used = errData.used;
      err.limit = errData.limit;
      emitAiLimit({
        reason: 'daily_limit_reached',
        message,
        used: errData.used,
        limit: errData.limit,
        bucket: errData.bucket,
      });
      throw err;
    }
    if (resp.status === 402) {
      const message =
        'You have run out of AI credits. Top up to keep generating tasks, quizzes and explanations.';
      const err: any = new Error(message);
      err.code = 'credits_exhausted';
      emitAiLimit({ reason: 'credits_exhausted', message });
      throw err;
    }
    throw new Error(errData.error || `AI request failed with status ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}
