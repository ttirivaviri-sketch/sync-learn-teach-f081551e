# Make "Delete account" easy to find

Account deletion already works in the app: Profile → Data & Compliance → Danger zone → "Delete my account", with a typed DELETE confirmation. It is just buried two screens deep.

## What changes

Add a clear **Delete account** entry at the bottom of the learner Profile menu (below Sign Out), styled in red.

Tapping it opens the same confirmation used today:
- Explains what is removed (profile, bookings, messages, study history, recordings, notes)
- Notes that de-identified payment records are kept 5 years for South African tax law
- Requires typing DELETE
- On success, signs out and returns to the sign-in screen

Same entry added to the tutor Profile menu so tutors can also delete their own account.

## Technical notes

- Extract the existing dialog from `src/pages/settings/DataCompliance.tsx` into a reusable `DeleteAccountDialog` component that calls the existing `delete-account` edge function.
- Use it from `LearnerProfileTab.tsx`, `TutorProfileTab.tsx`, and keep the Data & Compliance page using the same component (no duplicate logic).
- No database or edge-function changes.
