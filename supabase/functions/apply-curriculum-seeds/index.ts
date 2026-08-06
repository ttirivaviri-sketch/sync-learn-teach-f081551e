// Temporary one-off loader: applies verified curriculum topic template seeds
// (repo migrations) that were never executed against the database.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-loader-token',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const token = req.headers.get('x-loader-token') ?? '';
  const expected = Deno.env.get('SEED_LOADER_TOKEN') ?? '';
  if (!expected || token !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'rows required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const payload = rows.map((r: any) => ({
      curriculum: r.curriculum,
      grade: r.grade,
      subject: r.subject,
      topics: r.topics,
      source: 'verified',
      verified_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('curriculum_topic_templates')
      .upsert(payload, { onConflict: 'curriculum,grade,subject', ignoreDuplicates: true });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, inserted: payload.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
