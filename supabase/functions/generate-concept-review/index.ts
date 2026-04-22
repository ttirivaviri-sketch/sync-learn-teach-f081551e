import { corsHeaders } from '@supabase/supabase-js/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { question, concept_map, depth } = await req.json();
    if (!question || !concept_map) {
      return new Response(JSON.stringify({ error: 'question and concept_map required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not set');

    const isFull = depth === 'full';

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: `You generate pre-answer concept review tailored to a SPECIFIC question. NEVER produce generic textbook content. Every bullet, formula, and example must directly help answer THIS question. Use LaTeX for math.` },
          { role: 'user', content: `Question:\n${question}\n\nConcept map:\n${JSON.stringify(concept_map)}\n\nProduce ${isFull ? 'a full explanation with worked examples and common mistakes' : 'a quick review (3-5 bullets, key formulas, key definitions)'}.` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'concept_review',
            description: 'Return concept review',
            parameters: {
              type: 'object',
              properties: {
                quick_review: {
                  type: 'object',
                  properties: {
                    bullets: { type: 'array', items: { type: 'string' } },
                    formulas: { type: 'array', items: { type: 'string' } },
                    definitions: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['bullets', 'formulas', 'definitions'],
                },
                full_explanation: { type: 'string' },
                examples: { type: 'array', items: { type: 'string' } },
                common_mistakes: { type: 'array', items: { type: 'string' } },
                testing_focus: { type: 'array', items: { type: 'string' } },
              },
              required: ['quick_review', 'full_explanation', 'examples', 'common_mistakes', 'testing_focus'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'concept_review' } },
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
    if (!parsed) throw new Error('No review returned');

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-concept-review error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
