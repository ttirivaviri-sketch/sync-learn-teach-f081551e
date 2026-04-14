

## Plan: Tutor App Improvements

### Current State

The tutor app has four tabs (Home, Tutorials, Activity, Profile) with working booking management, availability scheduling, session history, earnings tracking, wallet/payouts, creator dashboard, chat, and video meetings. The build compiles without errors.

### Issues and Missing Features Found

**1. No Notification Bell in Tutor Header**
The learner app has `NotificationCenter` but the tutor header has no notification bell. Tutors receive notifications (booking requests, payments) but have no way to see them without the bell icon.

**Fix**: Add `NotificationCenter` component to the tutor header bar.

**2. Home Tab is Sparse -- Missing Key Information**
The home tab shows 4 stat cards, 2 quick actions, and today's schedule. It lacks:
- A welcome/greeting with the tutor's name
- Pending booking requests count (urgent action item)
- A notification badge on the bottom nav for pending requests

**Fix**: Add a greeting row, pending requests alert card, and badge dot on the Activity tab icon when there are pending bookings.

**3. "Tax Report" Button is a Stub**
The Download Tax Report button just shows "Feature coming soon!" toast.

**Fix**: Generate a basic CSV export of completed sessions (date, student, subject, amount, duration) downloadable in-browser. No external service needed.

**4. No Student Insights Integration in Booking Manager**
The `StudentInsightsPanel` component exists but isn't used in the booking flow. Tutors can't see AI-generated learning profiles for their students before sessions.

**Fix**: Add a "View Insights" button on each booking card in `TutorBookingManager` that expands to show the `StudentInsightsPanel` for that learner.

**5. No Onboarding for New Tutors**
When a tutor first signs up, there's no guided setup to add subjects, set availability, or complete their profile. They land on an empty home tab.

**Fix**: Add a "Getting Started" checklist card on the Home tab that shows incomplete setup steps (add subjects, set availability, add bio/photo, add qualifications) and links to the relevant tabs/sections.

**6. Console Warning: Fragment `data-lov-id` Prop**
There's a React warning about an invalid `data-lov-id` prop on `React.Fragment` in `StudyModeWrapper.tsx`. This is a dev-only warning but should be cleaned up.

**Fix**: Move the `data-lov-id` prop from `<Fragment>` to a wrapper `<div>`.

---

### Implementation Priority

| Task | Effort | Impact |
|------|--------|--------|
| Add NotificationCenter to tutor header | Small | High |
| Add pending requests badge + alert card on Home | Small | High |
| Add tutor greeting with name on Home | Small | Medium |
| Add Getting Started checklist for new tutors | Medium | High |
| Add Student Insights button in booking cards | Small | Medium |
| Implement Tax Report CSV export | Medium | Medium |
| Fix Fragment prop warning | Tiny | Low |

### Files to Change

| File | Change |
|------|--------|
| `src/pages/TutorApp.tsx` | Import & render `NotificationCenter` in header; pass pending count to bottom nav badge |
| `src/pages/tutor/TutorHomeTab.tsx` | Add greeting, pending requests alert, Getting Started checklist |
| `src/components/booking-manager/BookingCard.tsx` | Add "View Insights" toggle with `StudentInsightsPanel` |
| `src/pages/tutor/TutorProfileTab.tsx` | Replace stub toast with CSV generation logic for tax report |
| `src/studymode/StudyModeWrapper.tsx` | Move `data-lov-id` off Fragment |

### Technical Details

**Notification Center** -- Already built as a standalone component. Just import and place it next to the chat/logout buttons in the header.

**Pending Badge** -- Count bookings where `status === 'requested'` from the existing `bookings` array and render a red dot on the Activity nav icon.

**Getting Started Checklist** -- Check: `mySubjects.length > 0`, availability slots exist (query `tutor_availability`), profile has bio and avatar. Show/hide the card based on completion.

**Tax Report CSV** -- Use the existing `recentEarnings` data (or fetch all completed bookings) and generate a CSV blob with `URL.createObjectURL` for download. No backend needed.

**Student Insights** -- The `StudentInsightsPanel` component already accepts `studentId`, `studentName`, `tutorId`. Just conditionally render it inside `BookingCard` when expanded.

