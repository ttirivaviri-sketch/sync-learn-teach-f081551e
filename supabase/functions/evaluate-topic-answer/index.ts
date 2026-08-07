import { enforceQuota, quotaExceededResponse, reportTokenUsage, requireCaller } from "../_shared/ai-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Server-side XP rules
function computeXP(level: string, accuracy: boolean, coverage: number, difficulty: string): number {
  const mult = difficulty === 'easy' ? 0.6 : difficulty === 'hard' ? 1.4 : 1.0;
  let base = 0;
  if (level === 'exam_ready') base = 9;
  else if (level === 'close' && accuracy) base = 5;
  else if (level === 'developing') base = -2;
  else if (level === 'weak') base = -3;
  else if (accuracy) base = 5;
  else base = -3;
  return Math.round(base * mult);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const auth = await requireCaller(req);
  if (auth.response) return auth.response;
  const quota = await enforceQuota(req, 'explain', { userId: auth.caller.userId });
  if (!quota.allowed) return quotaExceededResponse('explain', quota.used, quota.limit);

  try {
    const { question, expected_answer, student_answer, concept_map } = await req.json();
    if (!question || !student_answer) {
      return new Response(JSON.stringify({ error: 'question and student_answer required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not set');

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        max_tokens: 600,
        messages: [
          { role: 'system', content: `You are a strict exam grader. Evaluate the student's answer on three layers: accuracy (correct/incorrect), coverage (% of key points 0-1), expression (structure/exam-style 0-1). Identify missing points. Set level: exam_ready (accuracy=true, coverage>=0.9, expression>=0.8, no missing points), close (accuracy=true, minor gaps), developing (partially right), weak (mostly wrong/blank). Be fair but exam-strict.` },
          { role: 'user', content: `Question:\n${question}\n\nExpected answer:\n${expected_answer || '(use concept map)'}\n\nConcept map:\n${JSON.stringify(concept_map || {})}\n\nStudent answer:\n${student_answer}` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'evaluate_answer',
            description: 'Return multi-layer evaluation',
            parameters: {
              type: 'object',
              properties: {
                accuracy: { type: 'boolean' },
                coverage_score: { type: 'number', minimum: 0, maximum: 1 },
                expression_score: { type: 'number', minimum: 0, maximum: 1 },
                missing_points: { type: 'array', items: { type: 'string' } },
                improvement_needed: { type: 'boolean' },
                level: { type: 'string', enum: ['exam_ready', 'close', 'developing', 'weak'] },
                feedback: { type: 'string' },
              },
              required: ['accuracy', 'coverage_score', 'expression_score', 'missing_points', 'improvement_needed', 'level', 'feedback'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'evaluate_answer' } },
      }),
    });

    if (resp.status === 429 || resp.status === 402) {
      return new Response(JSON.stringify({ error: resp.status === 429 ? 'Rate limited' : 'Credits exhausted' }), {
        status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();

    // Record real token usage (fire-and-forget).
    if (data?.usage) {
      reportTokenUsage({
        userId: quota.userId,
        bucket: "explain",
        tokensIn: Number(data.usage.prompt_tokens ?? 0),
        tokensOut: Number(data.usage.completion_tokens ?? 0),
      });
    }

    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : null;
    if (!parsed) throw new Error('No evaluation returned');

    // Enforce exam_ready rule strictly
    const isExamReady =
      parsed.accuracy === true &&
      (parsed.coverage_score ?? 0) >= 0.9 &&
      (parsed.expression_score ?? 0) >= 0.8 &&
      (Array.isArray(parsed.missing_points) ? parsed.missing_points.length === 0 : true);
    if (isExamReady) parsed.level = 'exam_ready';
    else if (parsed.level === 'exam_ready') parsed.level = 'close';

    const difficulty = concept_map?.difficulty || 'medium';
    parsed.xp_delta = computeXP(parsed.level, !!parsed.accuracy, parsed.coverage_score ?? 0, difficulty);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('evaluate-topic-answer error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
