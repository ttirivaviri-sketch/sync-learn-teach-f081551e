const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
          {
            role: 'system',
            content: `You generate pre-answer concept review tailored to a SPECIFIC question. NEVER produce generic textbook content. Every bullet, formula, definition, example, and common mistake must directly help the student answer THIS exact question. Be concise and exam-focused.\n\n${KATEX_RULES}`,
          },
          {
            role: 'user',
            content: `Question:\n${question}\n\nConcept map:\n${JSON.stringify(concept_map)}\n\nProduce ${isFull ? 'a FULL review: detailed quick_review (5-7 bullets, all relevant formulas, key definitions), a thorough full_explanation, 2-3 worked examples, common_mistakes, and testing_focus.' : 'a QUICK review: 3-5 bullets, key formulas, key definitions, brief full_explanation (1-2 sentences), 1 example, common_mistakes, and testing_focus.'} ALL fields are required and must be specific to this question.`,
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'concept_review',
            description: 'Return concept review tailored to the question',
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
                  additionalProperties: false,
                },
                full_explanation: { type: 'string' },
                examples: { type: 'array', items: { type: 'string' } },
                common_mistakes: { type: 'array', items: { type: 'string' } },
                testing_focus: { type: 'array', items: { type: 'string' } },
              },
              required: ['quick_review', 'full_explanation', 'examples', 'common_mistakes', 'testing_focus'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'concept_review' } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('AI gateway error:', resp.status, errText);
      return new Response(JSON.stringify({ error: 'AI gateway error', details: errText }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      console.error('No tool_calls in response:', JSON.stringify(data));
      throw new Error('No review returned by model');
    }

    let parsed;
    try {
      parsed = typeof args === 'string' ? JSON.parse(args) : args;
    } catch (parseErr) {
      console.error('Failed to parse tool args:', args);
      throw new Error('Malformed review JSON');
    }

    // Defensive normalization to guarantee shape
    const result = {
      quick_review: {
        bullets: Array.isArray(parsed?.quick_review?.bullets) ? parsed.quick_review.bullets : [],
        formulas: Array.isArray(parsed?.quick_review?.formulas) ? parsed.quick_review.formulas : [],
        definitions: Array.isArray(parsed?.quick_review?.definitions) ? parsed.quick_review.definitions : [],
      },
      full_explanation: typeof parsed?.full_explanation === 'string' ? parsed.full_explanation : '',
      examples: Array.isArray(parsed?.examples) ? parsed.examples : [],
      common_mistakes: Array.isArray(parsed?.common_mistakes) ? parsed.common_mistakes : [],
      testing_focus: Array.isArray(parsed?.testing_focus) ? parsed.testing_focus : (Array.isArray(concept_map?.concepts) ? concept_map.concepts : []),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-concept-review error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
