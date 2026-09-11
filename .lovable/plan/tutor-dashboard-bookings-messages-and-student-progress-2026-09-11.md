# Tutor dashboard: bookings, messages and student progress

Today a tutor's Home tab shows stats and today's schedule; bookings live in a separate tab, chat is a floating button with no inbox, and there is no view of student progress. This turns Home into a real dashboard.

## What the tutor sees

**1. Session overview (top)**

- Pending requests count with Accept/Decline right on the card
- Next session with a countdown and Join button when it's within 15 minutes
- Today's earnings, sessions, hours and rating (kept as-is)

**2. Bookings snapshot**

- Three small tiles: Pending, Upcoming, Completed this week
- Each opens the existing full booking manager with that filter applied

**3. Messages**

- New inbox card listing recent conversations: student name, last message preview, time, unread dot
- Tap a row to open the existing chat with that student
- "See all" opens the full conversation list

**4. Student progress**

- A card per recent student: name, subject, sessions completed, last session date
- Tap to open a student detail sheet with their session history, topics covered and a progress summary
- Where a progress report already exists for that student, show a "View report" action

## Notes

- Nothing is removed: the Activity tab keeps the full booking manager, availability and history.
- Message and progress data is read through existing safe lookups, so students' emails and phone numbers stay hidden.
- Tutors only see students they actually have bookings with.

## Technical outline

- New `src/pages/tutor/TutorDashboardTab.tsx` composing existing pieces; `TutorHomeTab` becomes the dashboard host.
- Reuse `ConversationList` (`src/components/chat/ConversationList.tsx`) in a compact "inbox" mode; open chat via the existing `setChatWithUserId` handoff in `TutorApp.tsx`.
- Bookings tiles reuse `bookings` from `useRealtimeBookings`; tapping sets `activeTab="activity"` plus a status filter passed into `TutorBookingManager`.
- Student progress uses `useStudentInsights` / `progress_reports` reads scoped to the tutor's booking counterparties; add a `get_tutor_students` RPC only if RLS blocks the direct read (verify first).
- No changes to booking, payment or chat business logic.
- Use UI similar to learner app designs, ( ui must show relationship in design)