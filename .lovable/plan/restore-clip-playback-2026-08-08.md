# Restore clip playback

## Goal
Make every valid Library clip playable in the Clips feed across browser and installed mobile app contexts, with a clear fallback when a provider blocks embedding.

## Plan
1. **Consolidate video URL handling**
   - Replace the Clips feed’s separate regex/embed builder with the same robust URL parser used by the standard video player.
   - Support YouTube watch, short, Shorts, live, and existing embed URLs plus Vimeo, Loom, and direct video files.
   - Keep the original provider URL for fallback navigation.

2. **Use a reliable click-to-play player lifecycle**
   - Stop depending on autoplay and immediate `postMessage` commands before the YouTube player is ready.
   - Render a thumbnail with a clear play control, then mount the active player after user interaction; this satisfies browser and mobile WebView media policies.
   - Load only the active clip’s iframe, pause/unmount it when leaving the slide, and preserve vertical feed navigation.
   - Ensure overlays and feed controls do not intercept taps intended for the player.

3. **Handle provider failures visibly**
   - Add player load/error state with a short timeout instead of leaving a blank frame.
   - Offer “Open on YouTube” (or the relevant provider) whenever embedded playback is unavailable.
   - Keep direct uploaded videos on the native HTML video player with controls and inline playback.

4. **Verify the full flow**
   - Test representative seeded YouTube clips and a direct video URL through Library → Clips → play, swipe, return, pause, and external fallback.
   - Check desktop and the current mobile-sized viewport, including browser console and failed network requests.

## Confirmed current state
- Recent `library_system_resources` video rows contain valid-looking YouTube watch URLs and thumbnails.
- `useLibraryResources` maps `video_url` into `LibraryResource.videoUrl` for video rows.
- The Clips feed currently builds `youtube-nocookie.com` iframes with autoplay and sends play commands immediately; the exact runtime/provider failure is not exposed to the learner.

## Technical scope
Frontend only: the Clips feed and shared video URL/player utilities. No reseeding or database schema changes unless verification reveals malformed stored URLs.