
Goal: switch the app from authenticated 8x8 JaaS back to public Jitsi so users can join reliably without JWT/account credential issues.

Plan

1. Remove the JaaS dependency from the meeting startup flow
- Update `src/components/VideoMeeting.tsx` so `initSession()` no longer calls the `generate-jitsi-jwt` edge function.
- Load the public Jitsi script from `https://meet.jit.si/external_api.js` instead of `https://8x8.vc/{appId}/external_api.js`.
- Initialize the API with domain `meet.jit.si` and a plain `roomName` only, with no `jwt` and no `appId` prefix.

2. Keep the current meeting UI, overlays, and controls intact
- Preserve the existing precall screen, connecting screen, fullscreen meeting shell, notes panel, top bar, and bottom control bar.
- Keep the pointer-event fix already added so the embedded Jitsi UI remains clickable during startup.
- Reuse the same event listeners (`videoConferenceJoined`, `participantJoined`, `participantLeft`, mute/screen-share status, `readyToClose`) so the rest of the UX behaves the same.

3. Make room naming safe enough for public Jitsi
- Continue isolating each booking in its own room, but use a stronger room name format than a human-readable static value.
- Example approach: build a unique room from the booking id plus a random/session-specific suffix when needed, while still keeping both parties on the same booking in the same room.
- Avoid exposing JaaS-style `appId/roomName` formatting.

4. Add a clean fallback/error path for public mode
- Replace “Auth Failed” style errors with generic “Unable to start meeting” messaging since JWT auth will no longer be involved.
- Keep camera/mic permission handling as-is.
- If the Jitsi script fails to load, show a public-Jitsi-specific connection error and return the user safely to the precall state.

5. Leave the edge function in place but decouple it from the client
- Do not block the switch on deleting backend code.
- After the client is confirmed working with public Jitsi, optionally retire or disable `supabase/functions/generate-jitsi-jwt/index.ts` later.
- This minimizes risk and lets the video feature recover quickly.

Files to update
- `src/components/VideoMeeting.tsx` — main change
- Optional later cleanup: `supabase/functions/generate-jitsi-jwt/index.ts`

Technical details
- Change script source:
  - from: `https://8x8.vc/${appId}/external_api.js`
  - to: `https://meet.jit.si/external_api.js`
- Change API init:
  - from: `new JitsiMeetExternalAPI("8x8.vc", { roomName: fullRoomName, jwt, ... })`
  - to: `new JitsiMeetExternalAPI("meet.jit.si", { roomName, ... })`
- Remove:
  - `supabase.functions.invoke("generate-jitsi-jwt", ...)`
  - `appId`, `jwt`, `fullRoomName`
- Keep:
  - `prejoinPageEnabled: false`
  - waiting/joined state handling
  - current app chrome and control commands

Tradeoff to accept
- Public Jitsi is simpler and should unblock joining, but it removes the JaaS authentication layer.
- Room privacy will depend mainly on room-name unpredictability instead of token-based access control.

Validation after implementation
- Open a learner booking and a tutor booking and verify both land in the same room.
- Confirm the join flow works on mobile viewport without a blocked button.
- Verify mute, camera, screen share, hand raise, end call, summary screen, and waiting banner still work.
- Confirm there is no edge-function error involved in starting meetings anymore.
