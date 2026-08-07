import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { enforceQuota, quotaExceededResponse, reportTokenUsage, verifyCaller } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function safeJsonParse(text: string): any | null {
  try { return JSON.parse(text); } catch {}
  // strip markdown fences
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  // extract first {...} block
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

async function callGemini(prompt: string, system: string, attributeTo?: string | null): Promise<any> {
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  if (attributeTo && json?.usage) {
    reportTokenUsage({
      userId: attributeTo,
      bucket: 'misc',
      tokensIn: Number(json.usage.prompt_tokens ?? 0),
      tokensOut: Number(json.usage.completion_tokens ?? 0),
    });
  }
  const content = json?.choices?.[0]?.message?.content ?? '';
  const parsed = safeJsonParse(content);
  if (!parsed) throw new Error('AI returned unparseable JSON');
  return parsed;
}

const SYSTEM = `You are an expert curriculum designer with deep knowledge of African and international high school exam syllabi (ZIMSEC, Cambridge, IEB, NSC). You output ONLY valid JSON. You never abbreviate or skip topics — your output must cover the COMPLETE official syllabus.`;

function buildPrompt(curriculum: string, grade: string, subject: string, syllabusText: string | null) {
  return `Generate the COMPLETE official syllabus topic tree for:
Curriculum: ${curriculum}
Grade/Level: ${grade}
Subject: ${subject}

${syllabusText ? `OFFICIAL SYLLABUS REFERENCE (use as ground truth):\n${syllabusText.slice(0, 12000)}\n\n` : ''}Output JSON in this exact shape — nothing else:
{
  "topics": [
    {
      "name": "string (top-level syllabus strand, e.g. 'Algebra')",
      "subtopics": ["string sub-strand", ...],
      "learning_objectives": ["verb-led objective covering every assessment objective", ...],
      "key_concepts": ["granular concept name a teacher would test", ...],
      "assessment_objectives": ["AO1: …", "AO2: …", ...],
      "typical_question_styles": ["e.g. 'short structured 4-mark', 'extended 12-mark essay'", ...],
      "exam_weight": number (0-100, share of paper marks),
      "prerequisites": ["string topic name from earlier years", ...]
    }
  ]
}

Rules:
- Cover EVERY strand and sub-strand on the official ${curriculum} ${grade} ${subject} syllabus. Do NOT abbreviate or merge.
- Aim for 10–18 top-level topics where the syllabus warrants it.
- 4–10 subtopics per topic; 5–15 key_concepts per topic (granular — these drive day-to-day practice).
- exam_weight values across all topics should sum to ~100.
- Use proper subject terminology. For Math/Science, use LaTeX inside strings when needed.
- Do NOT include any explanation outside the JSON.`;
}

const VALIDATOR_SYSTEM = `You are a syllabus auditor. You output ONLY JSON.`;

function buildValidatorPrompt(curriculum: string, grade: string, subject: string, topics: any[]) {
  return `Review this AI-generated topic tree for ${curriculum} ${grade} ${subject}. Drop any topics that are NOT on the official syllabus, merge duplicates, and ensure exam_weight sums roughly to 100.

Input:
${JSON.stringify({ topics }).slice(0, 12000)}

Output JSON: { "topics": [...] } using the same schema. Return the cleaned version only.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const callerId = getUserIdFromRequest(req);
    const body = await req.json();
    const { curriculum, grade, subject, force = false, validate = true } = body ?? {};

    if (!curriculum || !grade || !subject) {
      return new Response(JSON.stringify({ error: 'curriculum, grade, subject required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Trusted server-side callers (bulk seeder / cron) present the cron secret.
    const cronSecret = req.headers.get('x-cron-secret');
    let trusted = !!(cronSecret && Deno.env.get('CRON_SECRET') && cronSecret === Deno.env.get('CRON_SECRET'));
    if (!trusted && cronSecret) {
      const { data: ok } = await supabase.rpc('verify_cron_token', { _token: cronSecret });
      trusted = ok === true;
    }

    // Each seed run is two expensive AI calls — require a signed-in user, then quota-gate.
    if (!trusted) {
      if (!callerId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const quota = await enforceQuota(req, 'misc');
      if (!quota.allowed) return quotaExceededResponse('misc', quota.used, quota.limit);
    }

    // `force: true` bypasses the exists-check and regenerates — admin/trusted only.
    let effectiveForce = trusted && force === true;
    if (force && !effectiveForce && callerId) {
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: callerId, _role: 'admin' });
      effectiveForce = isAdmin === true;
      if (!effectiveForce) console.warn('[seed-curriculum-topics] non-admin force ignored', callerId);
    }


    // 1. Skip if exists
    if (!effectiveForce) {
      const { data: existing } = await supabase
        .from('curriculum_topic_templates')
        .select('id')
        .eq('curriculum', curriculum)
        .eq('grade', grade)
        .eq('subject', subject)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ status: 'skipped', reason: 'exists' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 2. Look for syllabus document
    let syllabusText: string | null = null;
    let source: 'syllabus' | 'ai' | 'hybrid' = 'ai';
    const { data: docs } = await supabase
      .from('documents')
      .select('parsed_content')
      .eq('type', 'syllabus')
      .ilike('subject', subject)
      .limit(1);
    if (docs && docs.length > 0) {
      const pc = (docs[0] as any).parsed_content;
      syllabusText = typeof pc === 'string' ? pc : JSON.stringify(pc);
      source = 'hybrid';
    }

    // 3. Generate
    const prompt = buildPrompt(curriculum, grade, subject, syllabusText);
    // Long syllabus trees occasionally come back truncated/unparseable — retry once.
    let result: any;
    try {
      result = await callGemini(prompt, SYSTEM, callerId);
    } catch (e) {
      if (!/unparseable/i.test((e as Error).message)) throw e;
      result = await callGemini(prompt, SYSTEM, callerId);
    }
    let topics = Array.isArray(result?.topics) ? result.topics : [];
    if (topics.length === 0) throw new Error('AI returned no topics');

    // 4. Validator pass — runs for ALL sources by default. Quality matters
    //    more than cost on a one-shot per-template seed.
    if (validate) {
      try {
        const v = await callGemini(buildValidatorPrompt(curriculum, grade, subject, topics), VALIDATOR_SYSTEM, callerId);
        if (Array.isArray(v?.topics) && v.topics.length > 0) topics = v.topics;
      } catch (e) {
        console.warn('validator skipped:', (e as Error).message);
      }
    }

    // 5. Upsert
    const { error: upErr } = await supabase
      .from('curriculum_topic_templates')
      .upsert({
        curriculum, grade, subject,
        topics,
        source,
        verified_at: new Date().toISOString(),
      }, { onConflict: 'curriculum,grade,subject' });
    if (upErr) throw upErr;

    return new Response(JSON.stringify({
      status: 'ok', source, topic_count: topics.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('seed-curriculum-topics error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
