import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { buildMatrix } from '../_shared/curriculum-matrix.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function seedOnce(item: { curriculum: string; grade: string; subject: string }, force: boolean) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/seed-curriculum-topics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON}`,
    },
    body: JSON.stringify({ ...item, force }),
  });
  const txt = await res.text();
  let json: any = {};
  try { json = JSON.parse(txt); } catch { }
  const error = json?.error ?? (!res.ok ? txt.slice(0, 200) : null);
  return { ok: res.ok, status: json?.status ?? (res.ok ? 'ok' : 'error'), error, http: res.status };
}

// Retries on AI-gateway rate limits (429 / "Rate limit") with backoff,
// honouring "Retry after <n>ms" hints when present.
async function seedOne(item: { curriculum: string; grade: string; subject: string }, force: boolean) {
  let last = await seedOnce(item, force);
  for (let attempt = 0; attempt < 5 && !last.ok; attempt++) {
    const msg = String(last.error ?? '');
    const rateLimited = last.http === 429 || /rate limit/i.test(msg);
    if (!rateLimited) break;
    const hinted = Number(msg.match(/Retry after (\d+)ms/i)?.[1] ?? 0);
    const wait = Math.min(Math.max(hinted, 5000 * 2 ** attempt), 70000);
    await sleep(wait + Math.floor(Math.random() * 2000));
    last = await seedOnce(item, force);
  }
  return last;
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Auth: require admin via JWT OR cron secret
  const cronSecret = req.headers.get('x-cron-secret');
  const expected = Deno.env.get('CRON_SECRET');
  let authorized = !!(cronSecret && expected && cronSecret === expected);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  if (!authorized) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: roles } = await supabase
          .from('user_roles').select('role').eq('user_id', user.id);
        authorized = !!roles?.some((r: any) => r.role === 'admin');
      }
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({}));
  const { force = false, concurrency = 2, only } = body ?? {};

  const matrix = (only && Array.isArray(only) && only.length > 0)
    ? only
    : buildMatrix();

  const { data: jobRow, error: jobErr } = await supabase
    .from('seeding_jobs')
    .insert({ kind: 'curriculum_topics', status: 'running', total: matrix.length })
    .select().single();
  if (jobErr) {
    return new Response(JSON.stringify({ error: jobErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const jobId = jobRow.id;

  // Fire-and-track: respond fast, run in background
  const runner = (async () => {
    let succeeded = 0, failed = 0, skipped = 0;
    const details: any[] = [];

    let idx = 0;
    async function worker() {
      while (idx < matrix.length) {
        const i = idx++;
        const item = matrix[i];
        try {
          const r = await seedOne(item, force);
          if (r.status === 'skipped') skipped++;
          else if (r.ok) succeeded++;
          else { failed++; details.push({ ...item, error: r.error }); }
        } catch (e) {
          failed++;
          details.push({ ...item, error: (e as Error).message });
        }
        if ((i + 1) % 5 === 0 || i === matrix.length - 1) {
          await supabase.from('seeding_jobs').update({
            succeeded, failed, skipped,
            details: details.slice(-50),
          }).eq('id', jobId);
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    await supabase.from('seeding_jobs').update({
      status: failed === matrix.length ? 'failed' : 'done',
      succeeded, failed, skipped,
      details: details.slice(-100),
      finished_at: new Date().toISOString(),
    }).eq('id', jobId);
  })();

  // Use waitUntil-ish: don't await, but keep alive via EdgeRuntime
  // @ts-ignore deno deploy
  if (typeof EdgeRuntime !== 'undefined' && (EdgeRuntime as any).waitUntil) {
    (EdgeRuntime as any).waitUntil(runner);
  } else {
    runner.catch(console.error);
  }

  return new Response(JSON.stringify({
    status: 'started', job_id: jobId, total: matrix.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
