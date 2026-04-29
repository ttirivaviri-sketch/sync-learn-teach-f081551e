import { enforceQuota, quotaExceededResponse } from "../_shared/ai-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const quota = await enforceQuota(req, 'misc');
  if (!quota.allowed) return quotaExceededResponse('misc', quota.used, quota.limit);

  try {
    const { question, subject, curriculum, topic } = await req.json();
    if (!question || !subject) {
      return new Response(JSON.stringify({ error: 'question and subject required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not set');

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: `You are a knowledge mapping engine for ${curriculum || 'ZIMSEC'} ${subject}. Map every question to its precise topic, subtopic, key concepts being tested, difficulty (easy/medium/hard), and what kind of exam answer is expected. Be specific and exam-aligned.` },
          { role: 'user', content: `Map this question:\n\n${question}${topic ? `\n\nHint topic: ${topic}` : ''}` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'map_concept',
            description: 'Return concept map for the question',
            parameters: {
              type: 'object',
              properties: {
                topic: { type: 'string' },
                subtopic: { type: 'string' },
                concepts: { type: 'array', items: { type: 'string' } },
                difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                exam_expectation: { type: 'string' },
              },
              required: ['topic', 'subtopic', 'concepts', 'difficulty', 'exam_expectation'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'map_concept' } },
      }),
    });

    if (resp.status === 429 || resp.status === 402) {
      return new Response(JSON.stringify({ error: resp.status === 429 ? 'Rate limited' : 'Credits exhausted' }), {
        status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : null;
    if (!parsed) throw new Error('No concept map returned');

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('map-question-concepts error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
