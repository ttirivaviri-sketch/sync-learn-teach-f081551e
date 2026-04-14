

## Plan: Uber-Style Clean Activity Tabs

Redesign both Learner and Tutor activity tabs to match the Uber Activity screenshot: bold section headers ("Upcoming", "Past"), minimal items shown by default, and "See all" buttons to reveal more.

### Learner Activity Tab (`src/pages/learner/LearnerActivityTab.tsx`)

Convert from a stateless arrow function to a stateful component with `useState`:

- **Header**: Bold "Activity" title at top
- **Pending Payments** (subsection under Upcoming): Show only the first pending payment. If more exist, show a "See all N pending" button. Collapsed by default.
- **Upcoming Sessions**: Show only the latest 1 upcoming session. If more exist, show "See all N upcoming" button. Empty state: card saying "No upcoming sessions" with "Book a tutor →" link (like the Uber "Reserve your trip →" pattern).
- **Past Sessions**: Show only 2 past sessions. If more exist, show "View all past sessions" button. Each past session card shows tutor name, date, price, and Rate/Rebook buttons (matching the Uber screenshot style).

State: `showAllPending`, `showAllUpcoming`, `showAllPast` — all default `false`.

### Tutor Booking Manager (`src/components/TutorBookingManager.tsx`)

Apply the same truncation pattern inside the existing tabbed view by modifying `renderBookingList` to accept `limit` and `showAll`/`onToggle` params:

- **Pending tab**: Show 1 request by default, "See all N requests" to expand
- **Upcoming tab**: Show 1 session by default, "See all N sessions" to expand
- **History tab**: Show 2 sessions by default, "View all history" to expand

State: `showAllPending`, `showAllUpcoming`, `showAllPast`.

### Styling

- Section headers: `text-2xl font-bold` for "Activity", `text-lg font-semibold` for "Upcoming"/"Past"
- "See all" buttons: `variant="ghost"` with subtle text, full width
- Empty states: clean card with text + arrow link (no heavy icons)
- Remove the `Badge` count from the section header — keep it minimal

### Files Changed

- `src/pages/learner/LearnerActivityTab.tsx` — Add state, limit items, add expand buttons
- `src/components/TutorBookingManager.tsx` — Add state, limit each tab's list

