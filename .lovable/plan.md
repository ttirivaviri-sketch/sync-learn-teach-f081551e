
## 1. Fix email delivery — switch to Lovable Emails on studysync.co.za

**Why emails fail today**: `send-guardian-report` and `send-progress-report` send via Resend using `onboarding@resend.dev` (a sandbox sender that only delivers to the API-key owner's verified inbox). No domain is verified, so all real recipients silently fail.

**Fix**:
1. Open the email-domain setup dialog so the user adds NS records for `notify.studysync.co.za` at their registrar (one-time, ~5 min).
2. Provision the queue/tables/cron job (pgmq, `email_send_log`, `suppressed_emails`, `process-email-queue`).
3. Scaffold the transactional email Edge Function (`send-transactional-email`) + unsubscribe page + suppression webhook.
4. Apply StudySync brand styling (white body, primary `#1a3fc4`, logo lockup, Inter font) to the template shell.

DNS verification can take up to 72h but scaffolding/code wiring proceeds immediately; sends start as soon as DNS is verified (status visible in Cloud → Emails).

## 2. Branded weekly Insights template (one template, two audiences)

Create `_shared/transactional-email-templates/student-insights.tsx` — a single React Email component with an `audience: "guardian" | "tutor"` prop that swaps tone, depth, and CTA:

```text
┌──────────────────────────────────────────┐
│  [StudySync logo]                        │
│  Weekly Insights · {Student Name}        │
│  {Curriculum} · {Grade} · Week of {date} │
├──────────────────────────────────────────┤
│  Snapshot                                │
│   • Study time:   X hrs (▲/▼ vs last wk) │
│   • Avg score:    X%                     │
│   • Streak:       X days                 │
│   • Overall:      🟢 On track            │
├──────────────────────────────────────────┤
│  Per-subject (rows)                      │
│   Maths    🟡  62%  3/5 tasks  Exam 12d  │
│   English  🟢  78%  4/5 tasks  Exam 40d  │
│   ...                                    │
├──────────────────────────────────────────┤
│  Strengths        Areas to focus         │
│  • Algebra        • Trig identities      │
│  • Comprehension  • Essay structure      │
├──────────────────────────────────────────┤
│  Recommendations (audience-specific)     │
│   Guardian → encouraging + 2 actions     │
│   Tutor    → topic list + suggested plan │
├──────────────────────────────────────────┤
│  CTA: "View full report" → app deeplink  │
└──────────────────────────────────────────┘
```

Audience differences:
- **Guardian**: plain-language summary, encouraging tone, "How you can support" tips, no jargon.
- **Tutor**: data-dense, weak-concept list, suggested next-session focus, links to the booking insights panel.

Wire-ups:
- Replace the inline HTML in `send-guardian-report` with `supabase.functions.invoke('send-transactional-email', { body: { templateName: 'student-insights', recipientEmail, templateData: { audience: 'guardian', ... }, idempotencyKey: \`insights-${user_id}-${week_start}-guardian\` } })`.
- Update `send-progress-report` (manual student-triggered send) to use the same template with `audience: 'tutor'` for booked-tutor recipients and `audience: 'guardian'` for guardian recipients. Continue to attach the existing PDF.
- Update `useStudentInsights`/manual send UI to gate the tutor-recipient picker to **booked tutors only** (already partially done — re-verify the filter uses `bookings.status IN ('confirmed','completed')`).

## 3. Weekly auto-send (already-migrated `scheduled_insight_runs`)

The previous migration added `scheduled_insight_runs` and `weekly_report_dow`. Add the dispatcher:
- New Edge Function `dispatch-weekly-insights` (cron, every hour) → for each learner whose local DOW matches `weekly_report_dow` and who has no row in `scheduled_insight_runs` for the current week, enqueue one guardian email + one email per booked tutor, then upsert the run row.
- pg_cron entry calling it hourly with `Bearer ${CRON_SECRET}`.
- Idempotency key: `insights-${user_id}-${week_start}-${recipient_role}-${tutor_id?}`.

## 4. Seed 20+ free, CC-licensed high-school books with covers

Add to `library_system_resources` (kind=`book`, with `thumbnail_url` cover + `pdf_url`). Sources, all free & CC-licensed or public domain:

**Siyavula (CC-BY, ZA syllabus, Grades 10–12)** — Maths, Mathematical Literacy, Physical Sciences, Life Sciences (Grade 10/11/12 each = 12 books).
**OpenStax (CC-BY)** — College Algebra, Biology 2e, Concepts of Biology, Chemistry: Atoms First, Physics (5 books, mapped Grade 11–12).
**CK-12 FlexBooks (CC-BY-NC)** — Earth Science, Trigonometry, World History (3 books).
**Project Gutenberg (public domain literature)** — *Romeo and Juliet*, *Animal Farm* (where PD), *Things Fall Apart* extract, *A Tale of Two Cities*, *Pride and Prejudice* (5 set-work classics).

Total: ~25 books. Each row gets:
- Real cover image (hot-linked from publisher CDN, then mirrored to `library-covers` storage bucket for stability).
- Curriculum tags (`ZIMSEC`/`CAMB`/`IEB`/`NSC` per relevance) so the personalisation engine surfaces them correctly.
- `grade_levels` array (e.g. `['Grade 10','Grade 11','Form 4','O-Level','IGCSE']`) so multi-grade content shows for all matching learners.
- `subject` matched to canonical names used in Library tabs.

Implemented as a single SQL `INSERT … ON CONFLICT (title) DO NOTHING` migration so it's idempotent and re-runnable.

## Technical notes

- Order of operations: domain setup dialog → infra setup → scaffold → template + wiring → cron dispatcher → book seed.
- `RESEND_API_KEY` paths in `send-guardian-report` and `send-progress-report` will be removed; both functions become thin orchestrators that call `send-transactional-email`. Existing PDF attachment in `send-progress-report` is preserved.
- All recipient resolution uses the new `personalization.ts` helpers + booked-tutor filter; no contact info leaks (uses `tutors_public` view).
- Insights template subject line: `"{StudentName}'s StudySync weekly insights — week of {Mon DD}"`.
- After scaffold, run `deploy_edge_functions` for every touched function.

## Out of scope (call out)

- Building a full marketing/newsletter system (Lovable Emails covers transactional only).
- Replacing the manual send flow in the app — it stays, but recipient list is locked to booked tutors + guardian.
