# Fix Clips Playback — Evidence First

## Goal
Make clips actually play inside the learner Clips feed without changing unrelated library features or reseeding content.

## Confirmed current state
- Stored clip rows contain valid-looking YouTube watch URLs and matching thumbnail IDs.
- The library mapping passes `video_url` into the Clips feed.
- The active clip renders a YouTube iframe; the previous verification checked only iframe loading, not successful playback.
- The player currently uses a cross-origin iframe with `referrerPolicy="strict-origin-when-cross-origin"`. YouTube Error 153 is a player identity/referrer rejection, not an autoplay failure.

## Implementation plan
1. Reproduce playback on an authenticated learner session and capture the YouTube iframe’s player error plus failed network response after pressing its native play button.
2. Replace the current iframe setup with a small provider player component that:
   - supplies the embedding origin expected by YouTube,
   - preserves the required referrer/client identity,
   - reports provider errors instead of treating iframe `onLoad` as playback success,
   - keeps native controls and requires a real user tap.
3. If YouTube still rejects embedding in the Lovable preview or device webview, use an explicit in-app launch/open-video fallback for that provider rather than showing a nonfunctional player.
4. Verify three real database clips end-to-end: open Clips, press play, observe playback time advance, swipe to another clip, play again, and confirm the previous player stops.
5. Check the mobile viewport and ensure feed overlays do not intercept player controls.

## Scope guard
- No new clips, database migrations, redesigns, or unrelated playback changes.
- Do not claim success from iframe load; success requires observed media playback/time progression.