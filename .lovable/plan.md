

## Plan: Fix Jitsi Meet Connection — Both Users Stuck on "Waiting"

### Root Cause

The `meet.jit.si` public instance has increasingly restricted External API (`JitsiMeetExternalAPI`) usage. The free public Jitsi server now requires authentication for embedded iframe use, causing both participants to join what appear to be isolated rooms — the `participantJoined` event never fires because the server doesn't bridge them.

Additionally, there's a defensive issue: if `room_name` happens to be `null` in the DB (e.g., older bookings created before the `room_name` field was added), the fallback uses `booking?.id` which could differ if the booking object shape varies between tutor and learner queries.

### Fix

**1. Switch Jitsi domain to `8x8.vc` (JaaS free tier) (`src/components/VideoMeeting.tsx`)**
- Replace `"meet.jit.si"` with `"8x8.vc"` which still supports the free External API for basic usage
- Alternatively, add `"jitsi1.oovoo.com"` or another public instance as a fallback
- Add logging of the actual `roomName` used so mismatches can be debugged

**2. Ensure deterministic room names (`src/components/VideoMeeting.tsx`)**
- Change the fallback from `booking?.room_name || StudySync-${booking?.id || "demo-session"}` to always use the booking ID as the canonical room name: `StudySync-${booking?.id}`
- This guarantees both sides join the same room even if `room_name` is null

**3. Add debug toast showing room name on join (`src/components/VideoMeeting.tsx`)**
- Temporarily show the room name in the "Connected" toast so you can verify both users are in the same room during testing

**4. Remove `TOOLBAR_BUTTONS: []` override (`src/components/VideoMeeting.tsx`)**
- Empty toolbar buttons array may cause Jitsi to behave unexpectedly on some instances — remove it and let the custom control bar handle the UI (toolbarButtons are already hidden by the z-index overlay)

### Files Changed
1. `src/components/VideoMeeting.tsx` — Switch domain, fix room name fallback, add debug logging, clean config

