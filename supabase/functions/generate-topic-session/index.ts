import { corsHeaders } from '@supabase/supabase-js/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { subject, curriculum, topic, subtopic, weak_concepts } = await req.json();
    if (!subject || !topic) {
      return new Response(JSON.stringify({ error: 'subject and topic required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not set');

    const weakHint = (weak_concepts && Array.isArray(weak_concepts) && weak_concepts.length)
      ? `\n\nThe student is weak in: ${weak_concepts.slice(0, 5).join(', ')}. Bias 50% of questions toward these gaps.`
      : '';

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: `You are a ${curriculum || 'ZIMSEC'} ${subject} content engine. Generate exam-aligned learning content. Use LaTeX for any math. Be concise, specific, exam-focused. Never generic.` },
          { role: 'user', content: `Topic: ${topic}${subtopic ? `\nSubtopic: ${subtopic}` : ''}${weakHint}\n\nGenerate a focused mini-session: concept overview, quick review bullets, 6 practice questions (mix of difficulty), and 4 flashcards. Each question must include its concept_map (topic, subtopic, concepts, difficulty, exam_expectation).` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'topic_session',
            description: 'Return session content',
            parameters: {
              type: 'object',
              properties: {
                concept_learning: { type: 'string' },
                quick_review: { type: 'array', items: { type: 'string' } },
                questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      question: { type: 'string' },
                      expected_answer: { type: 'string' },
                      concept_map: {
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
                    required: ['question', 'expected_answer', 'concept_map'],
                  },
                },
                flashcards: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { front: { type: 'string' }, back: { type: 'string' } },
                    required: ['front', 'back'],
                  },
                },
              },
              required: ['concept_learning', 'quick_review', 'questions', 'flashcards'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'topic_session' } },
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
    if (!parsed) throw new Error('No session content returned');

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-topic-session error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
