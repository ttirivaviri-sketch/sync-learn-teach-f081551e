

## Plan: Flexible Time Picker for Bookings

### Problem
Currently, learners can only select from predefined tutor availability slots (e.g., "9 AM - 10 AM"). They cannot pick a custom start time like 9:15 or 11:35, and there's no "Now" option for immediate sessions.

### Solution
Replace the rigid slot buttons with a flexible time picker. When a day is selected, show the tutor's available windows (e.g., "9 AM - 12 PM"), then let the learner pick any start time within those windows using hour/minute selects (in 5-min increments). Add a "Now" button for starting immediately if the tutor is available right now.

### Changes

**`src/components/TutorAvailabilityDisplay.tsx`**
- After selecting a day, show available windows as labels (e.g., "Available: 9:00 AM - 12:00 PM")
- Replace slot buttons with two `<Select>` dropdowns: hour and minute (5-min increments: 00, 05, 10, ..., 55)
- Only allow times that fall within the tutor's available windows for that day
- Add a "Now" button that auto-selects current time if it falls within an available window
- When a time is picked, call `onSelectSlot(date, "HH:MM", endTime)` where endTime is calculated from the booking duration

**`src/components/advanced-booking/BookingFormPanel.tsx`**
- Pass `duration` to `TutorAvailabilityDisplay` so end time can be calculated from the chosen start + duration
- The end time shown in the confirmation strip adjusts based on selected start time + duration

**`src/components/TutorAvailabilityDisplay.tsx` interface update**
- Add optional `durationMinutes` prop to calculate the end time from the flexible start time

### Files Changed
- `src/components/TutorAvailabilityDisplay.tsx` — Flexible time picker with hour/minute selects + "Now" button
- `src/components/advanced-booking/BookingFormPanel.tsx` — Pass duration prop through to availability display

