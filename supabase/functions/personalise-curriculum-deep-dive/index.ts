// personalise-curriculum-deep-dive
// Triggered after a learner completes onboarding. For each of their subjects,
// it expands the seeded topic tree into a concept-level coverage map written
// to `daily_task_concepts` so the daily-task engine has a full pool to draw
// from on day one. Idempotent — skips concepts that already exist.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Auth required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Identify caller via JWT
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Auth required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load this user's subjects (already seeded by useSeedSubjectsFromProfile)
    const { data: subjects } = await admin
      .from('subjects')
      .select('id, name, topics')
      .eq('user_id', user.id);

    if (!subjects?.length) {
      return new Response(JSON.stringify({ status: 'noop', reason: 'no subjects yet' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For each subject, walk topics → concepts and insert missing rows
    let inserted = 0;
    for (const s of subjects) {
      const topics = Array.isArray(s.topics) ? s.topics as any[] : [];
      const rows: any[] = [];
      for (const t of topics) {
        const topicName = String(t?.name ?? '').trim();
        if (!topicName) continue;
        const concepts: string[] = [];
        if (Array.isArray(t.key_concepts)) concepts.push(...t.key_concepts);
        if (Array.isArray(t.concepts)) concepts.push(...t.concepts);
        if (Array.isArray(t.subtopics)) concepts.push(...t.subtopics);
        const seen = new Set<string>();
        for (const c of concepts) {
          const concept = String(c ?? '').trim();
          if (!concept || seen.has(concept.toLowerCase())) continue;
          seen.add(concept.toLowerCase());
          rows.push({
            user_id: user.id,
            subject_id: s.id,
            subject_name: s.name,
            topic: topicName,
            concept,
            coverage_count: 0,
            last_covered_at: new Date(0).toISOString(),
          });
        }
      }
      if (!rows.length) continue;

      // Skip already-existing (subject_name + topic + concept)
      const { data: existing } = await admin
        .from('daily_task_concepts')
        .select('topic, concept')
        .eq('user_id', user.id)
        .eq('subject_name', s.name);
      const have = new Set((existing ?? []).map((r: any) => `${r.topic}::${r.concept}`.toLowerCase()));
      const toInsert = rows.filter(r => !have.has(`${r.topic}::${r.concept}`.toLowerCase()));
      if (toInsert.length) {
        const { error } = await admin.from('daily_task_concepts').insert(toInsert);
        if (!error) inserted += toInsert.length;
        else console.error('insert error', error.message);
      }
    }

    return new Response(JSON.stringify({ status: 'ok', subjects: subjects.length, concepts_inserted: inserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('personalise-curriculum-deep-dive error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
