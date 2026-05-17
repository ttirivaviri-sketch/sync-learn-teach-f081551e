# Country Selection + Legal Content

Two related additions: (1) ask new users for their country during onboarding so we can default their curriculum and currency, and (2) add proper legal pages (T&Cs, Privacy, Copyright/DMCA, Library Disclaimer) and surface them throughout the app.

---

## 1. Country selection on first sign-up

### What the user sees
A new **first step** in onboarding (before "Choose curriculum") titled *"Where are you studying?"* — a clean list of countries with flags:

- 🇿🇦 South Africa → defaults curriculum to **NSC**, currency to **ZAR**
- 🇿🇼 Zimbabwe → defaults curriculum to **ZIMSEC**, currency to **USD**
- 🇬🇧 United Kingdom → defaults curriculum to **CAMB**, currency to **GBP**
- 🌍 Other → defaults curriculum to **OTHER/CAMB**, currency to **USD**

The country is auto-detected from the browser locale / IP as a *suggestion*, but the user always confirms. The choice pre-selects (but does not lock) curriculum on the next step, so a Zimbabwean student studying Cambridge can still switch.

### Where it's used downstream
- **Curriculum default** in `CurriculumStep`
- **Currency display** across pricing, tutor rates, wallet, receipts (ZAR / USD / GBP)
- **Tutor discovery** can later weight local tutors
- **Exchange rate** — prices stored in ZAR (PayFast base), displayed converted using a daily-cached rate from a free FX API (exchangerate.host)

### Technical notes
- Add `country` (text, ISO-2) and `currency` (text, ISO-4217) columns to `profiles` (or `academic_profiles`).
- New component `CountryStep.tsx` inserted before `CurriculumStep` in `AcademicProfileSetup`.
- New `useCurrency()` hook reading from profile, with `formatPrice(amountZAR)` helper.
- Daily FX rates cached in a tiny `fx_rates` table refreshed by a scheduled edge function (or fetched client-side with 24h localStorage cache to keep it simple — recommended for v1).
- Existing users without a country: silent backfill from `auth.users` IP metadata where available; otherwise prompt once on next login via a small modal.

---

## 2. Legal pages and copyright notices

### New pages (under `/legal/*`)
1. **Terms of Service** (`/legal/terms`) — accounts, acceptable use, tutor/learner roles, bookings & cancellations, payments via PayFast, refunds, account termination, governing law (South Africa).
2. **Privacy Policy** (`/legal/privacy`) — POPIA + GDPR aligned: what we collect (academic profile, usage, payment metadata), why, retention, third parties (Supabase, PayFast, Lovable AI Gateway / Google Gemini, Jitsi), user rights (access, deletion, export), contact for data requests.
3. **Cookie Policy** (`/legal/cookies`) — essential vs analytics cookies, opt-out.
4. **Copyright & DMCA / Takedown Notice** (`/legal/copyright`) — how rights holders can report infringing material, response SLA, repeat-infringer policy.
5. **Library Content Disclaimer** (`/legal/library`) — explicitly states:
   - *"StudySync does not sell, license, or claim ownership of any third-party educational material in the Library. All past papers, textbooks, and syllabi remain the property of their respective publishers (ZIMSEC, Cambridge Assessment International Education, Department of Basic Education SA, IEB, and individual authors). Materials are aggregated from publicly available sources for educational, non-commercial student use under fair-dealing provisions."*
   - Lists known publishers with attribution.
   - Provides a takedown contact: `supportstudysync@gmail.com`.
6. **Acceptable Use / Community Guidelines** (`/legal/community`) — tutor conduct, anti-harassment, academic integrity (no exam-day cheating), AI usage policy.
7. **Refund Policy** (`/legal/refunds`) — 24h cancellation window, no-show rules, dispute process (mirrors existing `Refunds` admin logic).

### Surfacing
- **Footer**: replace dead `#` links in `Footer.tsx` with real routes.
- **Sign-up flows** (`LearnerAuth`, `TutorAuth`): add *"By creating an account you agree to our Terms and Privacy Policy"* checkbox (required, unchecked by default).
- **Booking checkout**: add line *"Subject to our Refund Policy"*.
- **Library tab**: small footer note *"Content credited to original publishers. See Library Disclaimer."* linking to `/legal/library`.
- **AI tutor chat**: one-time disclaimer *"AI responses are study aids, not authoritative. Always verify with your textbook."*

### Copyright credit display
- Each library resource already has metadata; add an `attribution` / `publisher` field if missing, and render it on the resource card (e.g. *"© ZIMSEC 2023 — Past Paper"*).

### Additional legal points worth stating
- **Age requirement** (13+, or 18+ for tutors; minors need guardian consent — already collect guardian email).
- **Tutor independent-contractor disclaimer** — tutors are not StudySync employees.
- **No guarantee of exam outcomes** — educational tool, not a pass guarantee.
- **Jurisdiction** — South African law, Cape Town courts.
- **Recording consent** for video sessions (Jitsi) — must be disclosed if any session is recorded.
- **Payment dispute / chargeback** policy referencing PayFast.

---

## Technical section

### DB migration
```sql
ALTER TABLE profiles
  ADD COLUMN country text,
  ADD COLUMN currency text DEFAULT 'ZAR',
  ADD COLUMN terms_accepted_at timestamptz,
  ADD COLUMN terms_version text;

CREATE TABLE fx_rates (
  base text NOT NULL,
  quote text NOT NULL,
  rate numeric NOT NULL,
  fetched_at timestamptz DEFAULT now(),
  PRIMARY KEY (base, quote)
);
ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fx_rates readable by all" ON fx_rates FOR SELECT USING (true);
```

### Files to add
- `src/pages/legal/{Terms,Privacy,Cookies,Copyright,Library,Community,Refunds}.tsx`
- `src/components/legal/LegalLayout.tsx` (shared shell)
- `src/components/academic-profile/CountryStep.tsx`
- `src/hooks/useCurrency.ts` + `src/lib/fx.ts`
- `src/lib/legal.ts` (constants: terms version, last-updated dates)

### Files to edit
- `src/App.tsx` — register `/legal/*` routes
- `src/components/AcademicProfileSetup.tsx` — insert country step + progress
- `src/components/Footer.tsx` — point links to real routes
- `src/pages/LearnerAuth.tsx`, `src/pages/TutorAuth.tsx` — T&C checkbox + version stamp
- `src/components/PaymentCheckout.tsx` — currency formatting + refund-policy link
- Library/resource cards — render attribution

---

## Out of scope (flag for later)
- Geo-IP detection accuracy (browser locale is good enough for v1).
- Multi-currency *payments* — PayFast still charges ZAR; we only **display** local currency.
- Formal legal review — recommend the user have an attorney review the drafted T&Cs before going live with paid accounts at scale.
