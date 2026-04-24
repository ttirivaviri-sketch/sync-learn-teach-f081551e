

# Plan: Guarantee Friday Guardian Reports Actually Send

## Why emails aren't sending today
The current `send-guardian-report` calls Resend directly, but **no `RESEND_API_KEY` secret is configured** and **no email domain is set up**. So every send silently logs "no key, report cached only" and exits. There's also no cron, so it never runs anyway.

## Fix — switch to Lovable's queue-backed email pipeline

### Step 1 — Set up a sender domain (one-time)
Required before any email infrastructure can be provisioned. Sender will be `reports@notify.studysync.co.za` (or your chosen subdomain).

### Step 2 — Provision email infrastructure
- pgmq queues + retry dispatcher (`process-email-queue` cron every 5s)
- `email_send_log`, `suppressed_emails`, `email_unsubscribe_tokens` tables
- Vault secret + service-role auth for the dispatcher
- Built-in retries (5 attempts), rate-limit handling, dead-letter queue, idempotency

### Step 3 — Scaffold transactional email + create the report template
- `send-transactional-email` Edge Function (queue-backed, automatic suppression checks)
- New React Email template `guardian-weekly-report.tsx` rendering the AI-written report:
  - Header with student name + week ending
  - **Overall summary** (AI narrative)
  - Per-subject cards: status pill, what went well, what was missed, struggling topics (bulleted), evidence stats, exam countdown
  - **Tutor recommendation panel** — yes/no + urgency + exact topics + "Find a tutor" CTA
  - Encouragement note for the parent
- Register in `registry.ts`, deploy

### Step 4 — Rewrite `send-guardian-report` to use the new pipeline
- Pull richer 7-day data: `study_activity`, `quiz_attempts`, `daily_tasks`, `concept_mastery`, `topic_performance`, `exam_dates`
- Generate AI narrative via Lovable AI Gateway (`google/gemini-2.5-flash`) with `safeJsonParse`. Output: per-subject status, what was missed, struggling topics, evidence, tutor recommendation with urgency + focus topics, parent encouragement
- For each student with `guardian_email`:
  - Upsert into `analytics_reports` (cache)
  - Invoke `send-transactional-email` with `templateName: "guardian-weekly-report"`, `idempotencyKey: guardian-{user_id}-{weekStart}`, `templateData: { aiReport, studentName, weekEnding, ... }`
  - Queue handles retries/rate limits — sends are guaranteed (or DLQ'd with logs)
- Remove all Resend code

### Step 5 — Friday 18:00 Harare cron (16:00 UTC)
Insert via data tool (contains project URL/anon key, not a migration):
```sql
select cron.schedule(
  'send-guardian-report-friday',
  '0 16 * * 5',
  $$ select net.http_post(
       url := 'https://uynoykcratwbcdzmsxfw.supabase.co/functions/v1/send-guardian-report',
       headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);
```
Enable `pg_cron` + `pg_net` extensions if not already.

### Step 6 — Add ZIMSEC primary grades (from previous request)
Extend `GRADE_LEVELS_BY_CURRICULUM.ZIMSEC` in `src/types/academicProfile.ts` to include `Grade 1–7` alongside `Form 1–6`. Add primary subjects (Environmental Science, Social Studies, ICT, Religious & Moral Education, Visual & Performing Arts) to the ZIMSEC subject list.

### Step 7 — Verify it actually sends
After deploy, manually invoke `send-guardian-report` once and check:
- `email_send_log` shows `pending` → `sent` for each guardian
- Edge Function logs show no errors
- Confirm Friday cron is scheduled in `cron.job`

## What changes vs. current setup
| Current | After |
|---|---|
| Direct Resend fetch | Queue-backed pipeline with retries + DLQ |
| No API key configured → silent fail | Lovable Email infra, no key needed |
| Rule-based thin report | AI-written narrative with specific topics + tutor reco |
| No schedule | Friday 18:00 Harare cron |
| No idempotency | `idempotencyKey` per (user, week) — safe re-runs |
| No suppression | Auto-blocks bounced/unsubscribed addresses |

## Files touched
- `src/types/academicProfile.ts` — ZIMSEC grades + primary subjects
- `supabase/functions/_shared/transactional-email-templates/guardian-weekly-report.tsx` — new template
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register template
- `supabase/functions/send-guardian-report/index.ts` — rewrite to AI + queue pipeline
- New cron job inserted via data tool

## Result
Every Friday at 6 PM Harare time, every learner with a `guardian_email` gets a detailed AI-written report. Sends go through a durable queue with automatic retries, rate-limit handling, suppression checks, and idempotency — no more silent failures. Grade 7 ZIMSEC learners can now select their grade.

<lov-actions>
<lov-open-email-setup>Set up email domain</lov-open-email-setup>
</lov-actions>

