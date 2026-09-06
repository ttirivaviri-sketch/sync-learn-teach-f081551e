/**
 * verify-curriculum-templates — bulk audit of curriculum_topic_templates
 * against official syllabus source material (parsed syllabus PDFs stored in
 * `public.documents` with type = 'syllabus').
 *
 * Auth: admin JWT or x-cron-secret.
 * Body: { only?: [{curriculum,grade,subject}], limit?: number, force?: boolean }
 *
 * Writes back onto each template: verification_status, coverage_score,
 * verification_report (missing/extra topics + notes), verified_against,
 * last_verification_at, and verified_at/verified_by when it passes.
 * Progress is tracked in `seeding_jobs` (kind = 'template_verification').
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

// A syllabus PDF is long; keep a generous slice (Gemini Flash has a 1M window).
const SYLLABUS_CHARS = 60_000;
const PASS_SCORE = 85;

function safeJsonParse(text: string): any | null {
  try { return JSON.parse(text); } catch { /* fallthrough */ }
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fallthrough */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fallthrough */ } }
  return null;
}

async function callAI(system: string, prompt: string): Promise<any> {
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
    const err: any = new Error(`AI gateway ${res.status}: ${t.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const parsed = safeJsonParse(json?.choices?.[0]?.message?.content ?? '');
  if (!parsed) throw new Error('AI returned unparseable JSON');
  return parsed;
}

const SYSTEM = `You are a syllabus auditor for national exam boards (ZIMSEC, Cambridge, IEB, NSC). You compare a generated topic tree against the official syllabus text and report gaps. You output ONLY valid JSON.`;

function buildPrompt(t: any, syllabus: string) {
  const names = (Array.isArray(t.topics) ? t.topics : []).map((x: any) => ({
    name: x?.name,
    subtopics: x?.subtopics ?? [],
    exam_weight: x?.exam_weight ?? null,
  }));
  return `Audit this topic tree for ${t.curriculum} ${t.grade} ${t.subject} against the official syllabus text below.

TOPIC TREE:
${JSON.stringify(names).slice(0, 30_000)}

OFFICIAL SYLLABUS TEXT:
${syllabus.slice(0, SYLLABUS_CHARS)}

Output JSON exactly:
{
  "coverage_score": number (0-100, share of official syllabus strands correctly represented),
  "missing_topics": ["official strand present in the syllabus but absent from the tree", ...],
  "extra_topics": ["topic in the tree that is NOT on this syllabus", ...],
  "misweighted_topics": ["topic whose exam_weight looks wrong vs the syllabus", ...],
  "notes": "one short paragraph for a curriculum admin"
}
Be strict: only list a topic as missing if the syllabus text clearly contains it.`;
}

async function findSyllabus(admin: any, subject: string, curriculum: string) {
  const { data } = await admin
    .from('documents')
    .select('id, name, parsed_content')
    .eq('type', 'syllabus')
    .ilike('subject', subject)
    .limit(5);
  const rows = (data ?? []).filter((d: any) => d.parsed_content);
  if (rows.length === 0) return null;
  // Prefer a document whose name mentions the curriculum.
  const preferred =
    rows.find((d: any) => String(d.name ?? '').toLowerCase().includes(curriculum.toLowerCase())) ??
    rows[0];
  const pc = preferred.parsed_content;
  const text = typeof pc === 'string' ? pc : JSON.stringify(pc);
  return { name: preferred.name as string, text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── Auth: cron secret or admin JWT ─────────────────────────────────────
  const cronSecret = req.headers.get('x-cron-secret');
  const expected = Deno.env.get('CRON_SECRET');
  let authorized = !!(cronSecret && expected && cronSecret === expected);
  let callerId: string | null = null;
  if (!authorized) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        callerId = user.id;
        const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
        authorized = isAdmin === true;
      }
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({}));
  const { only, limit = 10, force = false } = body ?? {};

  const query = admin
    .from('curriculum_topic_templates')
    .select('curriculum, grade, subject, topics, verification_status, last_verification_at')
    // Stalest first (never-verified rows lead) so repeated runs advance through
    // the full set instead of re-checking the same leading rows every time.
    .order('last_verification_at', { ascending: true, nullsFirst: true })
    .order('curriculum', { ascending: true })
    .order('grade', { ascending: true })
    .order('subject', { ascending: true });
  const { data: all } = await query;

  let candidates = (all ?? []).filter((t: any) => Array.isArray(t.topics) && t.topics.length > 0);
  if (Array.isArray(only) && only.length > 0) {
    const keys = new Set(only.map((o: any) => `${o.curriculum}|${o.grade}|${o.subject}`));
    candidates = candidates.filter((t: any) => keys.has(`${t.curriculum}|${t.grade}|${t.subject}`));
  } else if (!force) {
    candidates = candidates.filter((t: any) => (t.verification_status ?? 'unverified') === 'unverified');
  }

  const total = candidates.length;
  candidates = candidates.slice(0, Math.min(Number(limit) || 10, 40));
  const remaining = Math.max(total - candidates.length, 0);


  if (candidates.length === 0) {
    return new Response(JSON.stringify({ status: 'complete', remaining: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: jobRow, error: jobErr } = await admin
    .from('seeding_jobs')
    .insert({ kind: 'template_verification', status: 'running', total: candidates.length })
    .select().single();
  if (jobErr) {
    return new Response(JSON.stringify({ error: jobErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const jobId = jobRow.id;

  const runner = (async () => {
    let succeeded = 0, failed = 0, skipped = 0;
    const details: any[] = [];
    let halted: string | null = null;

    for (let i = 0; i < candidates.length; i++) {
      if (halted) break;
      const t: any = candidates[i];
      try {
        const src = await findSyllabus(admin, t.subject, t.curriculum);
        if (!src) {
          skipped++;
          details.push({ ...keyOf(t), status: 'no_source' });
          await admin.from('curriculum_topic_templates').update({
            verification_status: 'no_source',
            last_verification_at: new Date().toISOString(),
          }).match(keyOf(t));
          continue;
        }

        const report = await callAI(SYSTEM, buildPrompt(t, src.text));
        const score = Math.max(0, Math.min(100, Number(report?.coverage_score ?? 0)));
        const passed = score >= PASS_SCORE;

        const patch: Record<string, unknown> = {
          verification_status: passed ? 'verified' : 'needs_review',
          coverage_score: score,
          verification_report: {
            missing_topics: report?.missing_topics ?? [],
            extra_topics: report?.extra_topics ?? [],
            misweighted_topics: report?.misweighted_topics ?? [],
            notes: report?.notes ?? '',
          },
          verified_against: src.name,
          last_verification_at: new Date().toISOString(),
        };
        if (passed) {
          patch.source = 'verified';
          patch.verified_at = new Date().toISOString();
          if (callerId) patch.verified_by = callerId;
        }
        await admin.from('curriculum_topic_templates').update(patch).match(keyOf(t));

        succeeded++;
        details.push({ ...keyOf(t), score, status: patch.verification_status });
      } catch (e: any) {
        // Credit/policy failures are terminal — stop the whole batch.
        if (e?.status === 402 || e?.status === 403) {
          halted = `AI gateway ${e.status}: halted batch`;
          break;
        }
        failed++;
        details.push({ ...keyOf(t), error: String(e?.message ?? e) });
      } finally {
        if ((i + 1) % 3 === 0) {
          await admin.from('seeding_jobs').update({
            succeeded, failed, skipped, details: details.slice(-50),
          }).eq('id', jobId);
        }
      }
    }

    await admin.from('seeding_jobs').update({
      status: halted ? 'failed' : failed === candidates.length ? 'failed' : 'done',
      succeeded, failed, skipped,
      details: details.slice(-100),
      error: halted,
      finished_at: new Date().toISOString(),
    }).eq('id', jobId);
  })();

  // @ts-ignore deno deploy
  if (typeof EdgeRuntime !== 'undefined' && (EdgeRuntime as any).waitUntil) {
    // @ts-ignore deno deploy
    (EdgeRuntime as any).waitUntil(runner);
  } else {
    runner.catch(console.error);
  }

  return new Response(JSON.stringify({
    status: 'started', job_id: jobId, total: candidates.length, remaining,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});

function keyOf(t: any) {
  return { curriculum: t.curriculum, grade: t.grade, subject: t.subject };
}
