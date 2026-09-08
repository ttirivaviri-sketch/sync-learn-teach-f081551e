/**
 * ingest-syllabus-upload — take an official syllabus / subject-guideline PDF that
 * an admin uploaded to the private `syllabus-uploads` bucket, extract its full
 * text and file it in `public.curriculum_syllabus_sources` so
 * `verify-curriculum-templates` can audit topic trees against it.
 *
 * This is the manual counterpart to `ingest-syllabus-sources` (which downloads
 * Cambridge PDFs). DBE / IEB sites block automated fetching, so those documents
 * have to come in this way.
 *
 * Auth: admin JWT only.
 * Body: { path, curriculum, subject, grade?, name? }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const BUCKET = 'syllabus-uploads';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

  // ── Auth: admin JWT ────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (isAdmin !== true) return json({ error: 'Forbidden' }, 403);

  // ── Input ──────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const path = typeof body?.path === 'string' ? body.path.trim() : '';
  const curriculum = typeof body?.curriculum === 'string' ? body.curriculum.trim() : '';
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const grade = typeof body?.grade === 'string' && body.grade.trim() ? body.grade.trim() : null;
  const name = (typeof body?.name === 'string' && body.name.trim())
    ? body.name.trim().slice(0, 200)
    : path.split('/').pop() ?? 'Uploaded syllabus';

  if (!path || !curriculum || !subject) {
    return json({ error: 'path, curriculum and subject are required' }, 400);
  }
  if (path.includes('..')) return json({ error: 'invalid path' }, 400);

  // ── Download + extract ─────────────────────────────────────────────────
  const { data: file, error: dlErr } = await admin.storage.from(BUCKET).download(path);
  if (dlErr || !file) return json({ error: `Could not read the uploaded file: ${dlErr?.message ?? 'not found'}` }, 400);

  let text = '';
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const magic = new TextDecoder().decode(bytes.slice(0, 5));
    if (!magic.startsWith('%PDF')) throw new Error('that file is not a PDF');
    text = await pdfToText(bytes);
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    await admin.from('curriculum_syllabus_sources').upsert({
      curriculum, subject, grade, name,
      storage_path: path,
      content: null,
      char_count: 0,
      status: 'failed',
      error: message,
      fetched_at: new Date().toISOString(),
    }, { onConflict: 'curriculum,subject,name' });
    return json({ error: `Could not read that PDF: ${message}` }, 400);
  }

  if (text.length < 500) {
    return json({
      error: `Only ${text.length} characters of text could be read — this looks like a scanned PDF. Please upload a text-based copy.`,
    }, 400);
  }

  const { error: upErr } = await admin.from('curriculum_syllabus_sources').upsert({
    curriculum, subject, grade, name,
    storage_path: path,
    source_url: null,
    content: text,
    char_count: text.length,
    status: 'ready',
    error: null,
    fetched_at: new Date().toISOString(),
  }, { onConflict: 'curriculum,subject,name' });
  if (upErr) return json({ error: upErr.message }, 500);

  return json({ status: 'ready', curriculum, subject, grade, name, chars: text.length });
});
