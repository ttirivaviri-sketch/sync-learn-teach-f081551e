# WhatsApp Study Community page

A public page at `/community` that explains the StudySync WhatsApp study community, collects a short signup, then reveals the invite link. The welcome email links to this page instead of straight to WhatsApp.

## What the student sees

1. **Hero** — "Join the StudySync study community", short blurb from Ashlie Potera (same message as the welcome email: share notes, study plans, encouragement towards finals, talk directly to the team, report glitches and request features).
2. **Signup card** — Name, Email, Curriculum (ZIMSEC / Cambridge / CAPS-NSC / IEB / Other) and Grade/Level. Signed-in students get their name and email pre-filled.
3. **After submitting** — the card flips to a success state with a big green "Open WhatsApp community" button plus the plain link, so it also works if the button is blocked.
4. Returning visitors who already joined on that device skip straight to the link.
5. **What happens inside** — three short value points, and a note that group rules follow the Community Guidelines (link to `/legal/community`).

## Data

New table `community_signups`:
- name, email, curriculum, grade_level, user_id (null for guests), source (e.g. `welcome_email`, `landing`), created_at
- Anyone (signed out included) may add a signup; nobody can read the list except admins and server-side code. Duplicate email submissions are treated as the same person rather than erroring.

## Email change

`send-welcome-email`: the button and fallback link point to `https://studysync.co.za/community?src=welcome_email` instead of the raw WhatsApp URL. Wording stays as it is. Existing recipients are unaffected; this applies to new sends.

## Technical notes

- Route `/community` added in `src/App.tsx` (lazy loaded), plus a `/whatsapp` redirect to it.
- New page `src/pages/Community.tsx` built with the existing landing layout/`Seo` component; entry added to `src/lib/seoRoutes.ts` and `public/sitemap.xml` so it is indexable, with FAQ/JSON-LD consistent with the other landing pages.
- The WhatsApp URL stays centralised in `src/lib/whatsapp.ts` (add `WHATSAPP_COMMUNITY_URL`); page reads it from there.
- Form validated with zod (trimmed, length caps, email format) and inserted via the Supabase client; the invite link is only rendered after a successful insert. Local `localStorage` flag remembers a completed signup.
- Migration creates the table with insert-only grants for `anon`/`authenticated`, admin read via `has_role(auth.uid(),'admin')`, `service_role` full access, and a unique index on lowercased email with upsert-on-conflict.
- Link into the page from the learner home and the profile/support area is out of scope unless you want it.
