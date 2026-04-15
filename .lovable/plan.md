

## Plan: Fix Video Meeting Connection — Jitsi Container Lifecycle Bug

### Problem
When a user clicks "Join Session," Jitsi initializes during the `ConnectingScreen` phase and mounts its iframe into a **hidden** div (`className="hidden"`). When the screen transitions to "meeting," `ConnectingScreen` unmounts — **destroying the Jitsi iframe**. A new container div renders in the meeting screen, but Jitsi never re-mounts because `initJitsi` guards against re-initialization (`if (jitsiApi.current) return`).

Both tutor and learner see "Waiting for [other] to join…" because neither side's Jitsi iframe actually survives into the visible meeting view.

### Fix

**`src/components/VideoMeeting.tsx`**
- Move the Jitsi container ref out of `ConnectingScreen` and into the main component's render tree, so it persists across screen transitions
- Render a single `<div ref={jitsiContainer}>` that is always in the DOM but visually hidden during "connecting" and shown during "meeting"
- Remove the ref prop from `ConnectingScreen`

**`src/components/video-meeting/ConnectingScreen.tsx`**
- Remove the `forwardRef` wrapper and the hidden div — it no longer needs to host the Jitsi container

### Technical Detail

The root component will always render:
```
<div ref={jitsiContainer}
     className={screen === "meeting" ? "w-full h-full" : "fixed top-0 left-0 w-0 h-0 overflow-hidden"}
/>
```

This keeps Jitsi mounted and connected throughout, while hiding it during the connecting animation. When `videoConferenceJoined` fires, the screen switches to "meeting" and the container becomes visible — with the iframe already connected.

### Files Changed
- `src/components/VideoMeeting.tsx` — Persistent Jitsi container across all screens
- `src/components/video-meeting/ConnectingScreen.tsx` — Remove forwardRef and hidden container div

