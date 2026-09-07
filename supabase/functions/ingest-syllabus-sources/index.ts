/**
 * ingest-syllabus-sources — download official exam syllabus PDFs, extract their
 * full text and store them in `public.curriculum_syllabus_sources` so
 * `verify-curriculum-templates` can audit topic templates against real syllabi.
 *
 * Auth: admin JWT or x-cron-secret.
 *
 * Body:
 *   { catalog: true }                      → ingest the built-in official catalog
 *   { sources: [{ curriculum, subject, name, url, grade? }] }  → ingest specific URLs
 *   { force?: boolean }                    → re-fetch sources already stored
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const CAMBRIDGE = 'https://www.cambridgeinternational.org';

type Source = {
  curriculum: string;
  subject: string;
  name: string;
  url: string;
  grade?: string | null;
};

/**
 * Official Cambridge International syllabus documents (scraped from the
 * subject pages on cambridgeinternational.org, latest published version).
 * ZIMSEC O-Level tracks the Cambridge O-Level/IGCSE content closely, so the
 * same documents are registered for ZIMSEC subjects (per the O-Level ≡ IGCSE
 * equivalence already encoded in src/lib/personalization.ts). They are marked
 * in the document name so a reviewer can see the provenance.
 */
const CAMBRIDGE_CATALOG: Array<{ subject: string; file: string; zimsec?: string | null }> = [
  { subject: 'Accounting', file: '718141-2027-2029-syllabus.pdf', zimsec: 'Accounts' },
  { subject: 'Additional Mathematics', file: '745683-2028-2030-syllabus.pdf', zimsec: null },
  { subject: 'Art & Design', file: '743279-2028-2030-syllabus.pdf', zimsec: 'Art & Design' },
  { subject: 'Biology', file: '697203-2026-2028-syllabus.pdf', zimsec: 'Biology' },
  { subject: 'Business Studies', file: '596930-2023-2025-syllabus.pdf', zimsec: 'Business Studies' },
  { subject: 'Chemistry', file: '697205-2026-2028-syllabus.pdf', zimsec: 'Chemistry' },
  { subject: 'Combined Science', file: '745687-2028-2029-syllabus.pdf', zimsec: 'Combined Science' },
  { subject: 'Computer Science', file: '697167-2026-2028-syllabus.pdf', zimsec: 'Computer Science' },
  { subject: 'Economics', file: '718148-2027-2029-syllabus.pdf', zimsec: 'Economics' },
  { subject: 'English as a Second Language', file: '721337-2027-2029-syllabus.pdf', zimsec: null },
  { subject: 'English Language', file: '718783-2027-2029-syllabus.pdf', zimsec: 'English Language' },
  { subject: 'English Literature', file: '743323-2028-2030-syllabus.pdf', zimsec: 'English Literature' },
  { subject: 'French', file: '743340-2028-2030-syllabus.pdf', zimsec: null },
  { subject: 'Geography', file: '718150-2027-2029-syllabus.pdf', zimsec: 'Geography' },
  { subject: 'History', file: '721327-2027-2028-syllabus.pdf', zimsec: 'History' },
  { subject: 'ICT', file: '697139-2026-2028-syllabus.pdf', zimsec: 'ICT' },
  { subject: 'Mathematics', file: '745681-2028-2030-syllabus.pdf', zimsec: 'Mathematics' },
  { subject: 'Physics', file: '697209-2026-2028-syllabus.pdf', zimsec: 'Physics' },
];

function builtInCatalog(): Source[] {
  const out: Source[] = [];
  for (const c of CAMBRIDGE_CATALOG) {
    const url = `${CAMBRIDGE}/Images/${c.file}`;
    out.push({
      curriculum: 'CAMB',
      subject: c.subject,
      name: `Cambridge official syllabus (${c.file})`,
      url,
    });
    if (c.zimsec) {
      out.push({
        curriculum: 'ZIMSEC',
        subject: c.zimsec,
        name: `Cambridge O-Level/IGCSE equivalent syllabus (${c.file})`,
        url,
      });
    }
  }
  return out;
}

async function pdfToText(bytes: Uint8Array): Promise<string> {
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractText(doc, { mergePages: true });
  return (Array.isArray(text) ? text.join('\n') : text)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── Auth: cron secret or admin JWT ─────────────────────────────────────
  const cronSecret = req.headers.get('x-cron-secret');
  const expected = Deno.env.get('CRON_SECRET');
  let authorized = !!(cronSecret && expected && cronSecret === expected);
  if (!authorized) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
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
  const force = body?.force === true;

  let sources: Source[] = Array.isArray(body?.sources) ? body.sources : [];
  if (sources.length === 0 || body?.catalog === true) {
    sources = [...sources, ...builtInCatalog()];
  }
  sources = sources.filter((s) => s?.curriculum && s?.subject && s?.url && s?.name).slice(0, 80);

  if (!force) {
    const { data: existing } = await admin
      .from('curriculum_syllabus_sources')
      .select('curriculum, subject, name, status');
    const done = new Set(
      (existing ?? [])
        .filter((e: any) => e.status === 'ready')
        .map((e: any) => `${e.curriculum}|${e.subject}|${e.name}`),
    );
    sources = sources.filter((s) => !done.has(`${s.curriculum}|${s.subject}|${s.name}`));
  }

  if (sources.length === 0) {
    return new Response(JSON.stringify({ status: 'complete', ingested: 0, results: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch each distinct URL once, reuse the text across curricula.
  const textCache = new Map<string, { text?: string; error?: string }>();
  const results: any[] = [];

  for (const s of sources) {
    let entry = textCache.get(s.url);
    if (!entry) {
      entry = {};
      try {
        const res = await fetch(s.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StudySyncSyllabusBot/1.0)' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        const magic = new TextDecoder().decode(buf.slice(0, 5));
        if (!magic.startsWith('%PDF')) throw new Error('response is not a PDF');
        const text = await pdfToText(buf);
        if (text.length < 500) throw new Error(`extracted only ${text.length} chars`);
        entry.text = text;
      } catch (e: any) {
        entry.error = String(e?.message ?? e);
      }
      textCache.set(s.url, entry);
    }

    const row = {
      curriculum: s.curriculum,
      subject: s.subject,
      grade: s.grade ?? null,
      name: s.name,
      source_url: s.url,
      content: entry.text ?? null,
      char_count: entry.text?.length ?? 0,
      status: entry.text ? 'ready' : 'failed',
      error: entry.error ?? null,
      fetched_at: new Date().toISOString(),
    };
    const { error } = await admin
      .from('curriculum_syllabus_sources')
      .upsert(row, { onConflict: 'curriculum,subject,name' });

    results.push({
      curriculum: s.curriculum,
      subject: s.subject,
      status: error ? 'failed' : row.status,
      chars: row.char_count,
      error: error?.message ?? row.error,
    });
  }

  return new Response(JSON.stringify({
    status: 'done',
    ingested: results.filter((r) => r.status === 'ready').length,
    failed: results.filter((r) => r.status !== 'ready').length,
    results,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
