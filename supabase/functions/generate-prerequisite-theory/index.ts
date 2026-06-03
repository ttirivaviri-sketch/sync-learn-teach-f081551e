/**
 * generate-prerequisite-theory
 *
 * Returns a focused markdown/LaTeX refresher for a prerequisite topic so the
 * student can quickly close the gap before returning to the parent topic.
 *
 * POST body: { subject, prerequisiteTopic, missingConcepts[], curriculum?, grade?, parentTopic? }
 * Returns:   { theory: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getAIConfig,
  STUDYMODE_SYSTEM_IDENTITY,
  corsHeaders,
  callAI,
  errorResponse,
  jsonResponse,
} from "../_shared/ai-config.ts";
import { KATEX_RULES } from "../_shared/katex-rules.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ai = getAIConfig();
    const body = await req.json();
    const {
      subject,
      prerequisiteTopic,
      missingConcepts = [],
      curriculum = "ZIMSEC",
      grade,
      parentTopic,
    } = body ?? {};

    if (!subject || !prerequisiteTopic) {
      return jsonResponse(
        { error: "subject and prerequisiteTopic are required" },
        400,
      );
    }

    const systemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Write a concise, exam-focused REFRESHER on the prerequisite topic "${prerequisiteTopic}" so the student can confidently move on${parentTopic ? ` to "${parentTopic}"` : ""}.

RULES:
• Pure markdown only. No HTML. No code fences around the whole answer.
• ${KATEX_RULES}
• Structure: short intro → 2–4 key rules/definitions → ONE worked mini-example with steps → a one-line "why this matters for ${parentTopic ?? "the next topic"}".
• Aim for 180–320 words. Be specific, not generic.
• Tailor to ${curriculum}${grade ? ` ${grade}` : ""} level.`;

    const userPrompt = `Subject: ${subject}
Prerequisite topic: ${prerequisiteTopic}${parentTopic ? `\nParent topic the student is preparing for: ${parentTopic}` : ""}
Missing concepts to cover: ${Array.isArray(missingConcepts) && missingConcepts.length ? missingConcepts.join(", ") : "(infer the most common gaps)"}

Write the refresher now.`;

    const theory = await callAI(ai, systemPrompt, userPrompt, {
      temperature: 0.4,
      maxTokens: 900,
    });

    return jsonResponse({ theory: theory.trim() });
  } catch (e) {
    console.error("generate-prerequisite-theory error:", e);
    return errorResponse(e);
  }
});
