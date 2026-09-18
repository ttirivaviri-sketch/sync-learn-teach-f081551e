# Public tutor booking page

A new page at `/book` where any visitor can pick a tutor, a date and a time, and confirm a real booking request. No payment during booking — the tutor confirms first, then the learner pays.

## What the visitor sees

1. **Pick a tutor** — cards showing photo, name, subjects, rating, hourly rate and location, with search and a subject filter. Arriving from a tutor's profile page pre-selects that tutor.
2. **Pick subject, date and time** — the tutor's real availability for the next 7 days; unavailable days are greyed out. Sessions are 1 hour at the tutor's rate.
3. **Add a note** — optional "what would you like to focus on".
4. **Confirm** — a summary card (tutor, subject, day, time, price) with one "Confirm booking" button.

If the visitor is not signed in, step 4 shows a compact sign-up / sign-in panel instead. Their chosen slot is held while they create the account, and the booking is submitted automatically the moment they land back signed in — they never have to re-pick.

After confirming: a success screen saying the tutor has been notified and will accept, with links to their bookings and to add another session.

## Entry points

- Direct link `/book` (and `/book/:tutorId` for a specific tutor).
- Homepage tutor buttons and pricing section.
- "Book a tutor" / "Find my tutor" buttons on the tutoring and maths-tutor landing pages.
- "Book now" on tutor profile pages.
- Contact strip gets a "Book online" option alongside WhatsApp/email/phone.

Every one of these taps is still recorded in Tutor Enquiries as today, so you keep seeing demand — and now completed bookings too.

## Technical notes

- New `src/pages/BookTutor.tsx` + step components under `src/components/booking/`; routes `/book` and `/book/:tutorId` added to `src/App.tsx` as public routes.
- Tutor list comes from the existing `get_tutor_directory` RPC via `useTutorData` (already anon-safe). Availability reuses `TutorAvailabilityDisplay` (reads `tutor_availability`, filtered to available slots).
- Booking insert reuses `useRealtimeBookings().createBooking` — same `bookings` row shape (learner_id, tutor_id, tutor_subject_id, scheduled_at, duration_minutes, price, room_name), status defaults to `requested`, so tutor notifications, the tutor dashboard and payment-after-confirm all work unchanged. No schema changes.
- Pending selection (tutorId, subjectId, ISO datetime, duration, note) is stored in `sessionStorage` before redirecting to `/learner/auth?redirect=/book`; on return the page restores it and submits once, then clears the key.
- `duration_minutes` fixed at 60 to match the R300 / 1-hour session rule.
- Each confirmed submission also fires `trackEnquiryClick` with channel `booking` and source `book_page` so the admin Enquiries page and the email alert cover it.
- Mobile-first layout consistent with the app's existing card styling; no new colours or tokens.
