import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { reengagementEmail } from './templates.ts';
import { hasFreeSession } from './rules.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const schema = z.object({ dry_run: z.boolean().optional(), limit: z.number().int().min(1).max(50).optional() }).strict();
async function signature(id: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`reengagement-unsubscribe:${id}`)));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const cron = Deno.env.get('CRON_SECRET');
    if (!url || !service || !cron) return json({ error: 'Email service configuration missing' }, 503);
    const admin = createClient(url, service);
    const requestUrl = new URL(req.url);
    // Signed link grants only the right to stop this campaign. GET never writes:
    // scanners can inspect the link without unintentionally unsubscribing users.
    if (requestUrl.searchParams.get('action') === 'unsubscribe') {
      const parsed = z.object({ id: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse({ id: requestUrl.searchParams.get('id'), token: requestUrl.searchParams.get('token') });
      if (!parsed.success || !equal(parsed.data.token, await signature(parsed.data.id, cron))) return json({ error: 'Invalid unsubscribe link' }, 400);
      if (req.method === 'GET') {
        return new Response('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>StudySync reminders</h1><form method="post"><p>Stop receiving these feature reminders?</p><button type="submit">Unsubscribe</button></form></body></html>', { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'no-referrer' } });
      }
      if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      const { error } = await admin.from('learner_reengagement_campaigns').update({ unsubscribed_at: new Date().toISOString() }).eq('id', parsed.data.id);
      if (error) throw error;
      return new Response('<!doctype html><html><body><h1>You’re unsubscribed</h1><p>You will no longer receive StudySync feature reminders. Booking and account emails are unchanged.</p></body></html>', { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const rawBody = await req.json().catch(() => null);
    // Admin-only test send: does not touch the campaign ledger.
    if (rawBody && typeof rawBody === 'object' && 'test_user_id' in rawBody) {
      const t = z.object({ test_user_id: z.string().uuid(), step: z.number().int().min(1).max(3) }).strict().safeParse(rawBody);
      if (!t.success) return json({ error: 'Invalid request' }, 400);
      const { data: u } = await admin.auth.getUser(token);
      if (!u?.user) return json({ error: 'Unauthorized' }, 401);
      const { data: role } = await admin.from('user_roles').select('role').eq('user_id', u.user.id).eq('role', 'admin').maybeSingle();
      if (!role) return json({ error: 'Admins only' }, 403);
      const apiKey = Deno.env.get('RESEND_API_KEY');
      if (!apiKey) return json({ error: 'Resend not configured' }, 503);
      const { data: p, error: pe } = await admin.from('profiles').select('email,full_name').eq('id', t.data.test_user_id).single();
      if (pe || !p?.email) return json({ error: 'Learner not found' }, 404);
      const content = reengagementEmail(t.data.step, p.full_name ?? '', 'https://studysync.co.za', true);
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: Deno.env.get('RESEND_UPDATES_FROM') || 'StudySync <updates@studysync.co.za>', to: [p.email], ...content, subject: `[Test] ${content.subject}` }) });
      const details = await r.text();
      return json({ sent: r.ok, status: r.status, details }, r.ok ? 200 : r.status);
    }
    let authorized = equal(token, cron);
    if (!authorized && token) {
      const { data } = await admin.rpc('verify_cron_token', { _token: token });
      authorized = data === true;
    }
    if (!authorized) return json({ error: 'Unauthorized' }, 401);
    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) return json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
    if (parsed.data.dry_run) {
      const { count, error } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'learner').eq('is_suspended', false).lt('last_seen', new Date(Date.now() - 5 * 86_400_000).toISOString());
      if (error) throw error;
      return json({ dry_run: true, inactive_profiles: count, sends: 0 });
    }
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) return json({ error: 'Resend not configured' }, 503);
    const { data: candidates, error: claimError } = await admin.rpc('claim_learner_reengagement', { _limit: parsed.data.limit ?? 50 });
    if (claimError) throw claimError;
    let sent = 0, skipped = 0;
    for (const candidate of candidates ?? []) {
      const { data: campaign, error: campaignError } = await admin.from('learner_reengagement_campaigns').select('*').eq('id', candidate.campaign_id).single();
      const { data: profile, error: profileError } = await admin.from('profiles').select('last_seen,is_suspended,user_type').eq('id', candidate.learner_id).single();
      if (campaignError || profileError) throw campaignError ?? profileError;
      const [login, activity] = await Promise.all([
        admin.from('user_login_days').select('user_id').eq('user_id', candidate.learner_id).gt('last_at', campaign.inactive_since).limit(1),
        admin.from('study_activity').select('id').eq('user_id', candidate.learner_id).gt('created_at', campaign.inactive_since).limit(1),
      ]);
      if (login.error || activity.error) throw login.error ?? activity.error;
      if (campaign.stopped_at || campaign.unsubscribed_at || profile.is_suspended || profile.user_type !== 'learner' || new Date(profile.last_seen ?? campaign.inactive_since) > new Date(campaign.inactive_since) || login.data?.length || activity.data?.length) {
        const { error } = await admin.from('learner_reengagement_campaigns').update({ stopped_at: new Date().toISOString(), claimed_at: null }).eq('id', candidate.campaign_id);
        if (error) throw error;
        skipped++;
        continue;
      }
      const { count, error: taskError } = await admin.from('daily_tasks').select('id', { count: 'exact', head: true }).eq('user_id', candidate.learner_id);
      if (taskError) throw taskError;
      const unsubscribeUrl = `${url}/functions/v1/send-reengagement-emails?action=unsubscribe&id=${candidate.campaign_id}&token=${await signature(candidate.campaign_id, cron)}`;
      const content = reengagementEmail(candidate.next_step, candidate.full_name ?? '', unsubscribeUrl, hasFreeSession(count ?? 1));
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `learner-reminder/${candidate.delivery_key}` },
        body: JSON.stringify({ from: Deno.env.get('RESEND_UPDATES_FROM') || 'StudySync <updates@studysync.co.za>', to: [candidate.email], ...content, headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }),
      });
      if (!response.ok) {
        const details = await response.text();
        console.error(`Resend reminder failed [${response.status}]: ${details}`);
        // Preserve claim and idempotency key for the next daily retry.
        return json({ error: 'Email provider request failed', status: response.status, details, sent }, response.status);
      }
      const { error } = await admin.from('learner_reengagement_campaigns').update({ step: candidate.next_step, last_sent_at: new Date().toISOString(), claimed_at: null, delivery_key: null }).eq('id', candidate.campaign_id).eq('delivery_key', candidate.delivery_key);
      if (error) throw error;
      sent++;
      await new Promise(resolve => setTimeout(resolve, 650));
    }
    return json({ sent, skipped, claimed: candidates?.length ?? 0 });
  } catch (error) {
    console.error('Reengagement processing failed', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: error instanceof Error ? error.message : 'Processing failed' }, 500);
  }
});