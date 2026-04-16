

## Plan: Fix Jitsi Container Lifecycle — Iframe Destroyed on Screen Transition

### Root Cause
The `jitsiContainer` ref div exists in **two separate conditional returns**:
- Line 261: inside `if (screen === "connecting")` return
- Line 342: inside the meeting screen return

When the screen transitions from `connecting` → `meeting`, React unmounts the connecting return (destroying the Jitsi iframe) and mounts the meeting return with a **new empty div**. Both tutor and learner lose their Jitsi connection and see "waiting for the other person."

The `precall` return (line 239) doesn't include the container at all, so the ref is null when `initJitsi` first runs if timing is tight.

### Fix (`src/components/VideoMeeting.tsx`)

**Move the Jitsi container div to a single persistent location rendered in ALL screen states:**

1. Remove `<div ref={jitsiContainer}>` from the `connecting` return (line 261)
2. Remove `<div ref={jitsiContainer}>` from the meeting screen body (lines 340-343)
3. Add a single persistent Jitsi container div that renders **after every conditional return** — this won't work with early returns. Instead, restructure so all screens render inside a single return, with the Jitsi container always present:

```
return (
  <>
    {/* Persistent Jitsi container — always in DOM */}
    <div className={jitsiContainerClass}>
      <div ref={jitsiContainer} className="w-full h-full" />
    </div>

    {screen === "precall" && <PreCallScreen ... />}
    {screen === "connecting" && <ConnectingScreen ... />}
    {screen === "summary" && <MeetingSummaryScreen ... />}
    {screen === "meeting" && (
      <div className="fixed inset-0 flex flex-col bg-[#0d0d1a]">
        <MeetingTopBar ... />
        {/* errors, waiting banner, loading overlay, notes, controls */}
      </div>
    )}
  </>
);
```

4. Update `jitsiContainerClass` to show full-screen during `meeting` and `connecting`, and be hidden (`w-0 h-0 overflow-hidden`) during `precall` and `summary`.

### Why This Fixes It
The Jitsi iframe mounts once during `initJitsi` and stays in the DOM across all screen transitions. When `videoConferenceJoined` fires and screen flips to `meeting`, the iframe is already connected — no re-creation needed. Both users stay in the same room.

### Files Changed
1. `src/components/VideoMeeting.tsx` — Restructure to single return with persistent Jitsi container

