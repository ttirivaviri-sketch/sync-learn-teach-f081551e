

## Plan: Restore "Book Now" Button Visibility

### Problem
On the Learner Home tab, the `AdvancedBooking` component renders inline between "My Lessons" and the search bar. Its `TutorBrowseCard` only highlights on click with no visible "Book Now" button — users must scroll down to find the `BookingFormPanel`. On a 414px mobile viewport, this makes the booking action invisible.

Additionally, the home tab now has **two separate tutor listings** (one inside `AdvancedBooking`, one in the main tutor cards below), creating confusion about where to book.

### Fix

**1. Add "Book Now" button to `TutorBrowseCard` (`src/components/advanced-booking/TutorBrowseCard.tsx`)**
- Add a visible "Book Now" `Button` on each tutor card so users don't have to scroll to find the booking form after selecting a tutor

**2. Remove duplicate AdvancedBooking from LearnerHomeTab (`src/pages/learner/LearnerHomeTab.tsx`)**
- Remove the inline `<AdvancedBooking />` component (line 202) since the main tutor list already has "Book Online" and "In-Person" buttons that open the `QuickBookingModal`
- This eliminates the confusing duplicate tutor listing and restores the clean home tab layout

### Result
- Each tutor card in the main list retains its "Book Online", "In-Person", and "Chat" buttons
- No duplicate tutor sections on the home tab
- Clear, single booking path via `QuickBookingModal`

### Files Changed
1. `src/pages/learner/LearnerHomeTab.tsx` — Remove `<AdvancedBooking />` inline render
2. `src/components/advanced-booking/TutorBrowseCard.tsx` — Add "Book Now" button (only relevant if AdvancedBooking is kept elsewhere)

