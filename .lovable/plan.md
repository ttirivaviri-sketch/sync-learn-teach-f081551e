

## Plan: Instagram Reels-Style Video Feed

### What It Does

Adds a fullscreen vertical-swipe video feed to the Library's **Tutorials tab**. When a learner taps any tutorial video (or a new "Reels" entry point), they enter a TikTok/Instagram Reels-style experience: fullscreen videos, swipe up/down to navigate, interaction buttons on the right side, tutor info at the bottom.

### Files to Create

**`src/components/library/VideoReelsFeed.tsx`**
- Fullscreen overlay (`fixed inset-0 z-50 bg-black`)
- Uses CSS scroll-snap (`snap-y snap-mandatory`) on a vertical container — each video is one `snap-start` viewport-height slide
- Each slide renders:
  - **Center**: `<video>` element (direct URLs) or `<iframe>` (YouTube/Vimeo/Loom) — fullscreen, auto-plays when in view using IntersectionObserver, pauses when scrolled away
  - **Right side** (vertical stack): Heart/Like, Bookmark/Save, Book Tutor (GraduationCap icon), Share
  - **Bottom overlay** (gradient): Title, subject/topic badges, tutor avatar + name, duration
  - **Top-right**: Close (X) button to exit feed
- Tap-to-pause/play on direct videos
- Preloads next 2 videos via `preload="metadata"` on upcoming `<video>` elements
- Tracks which video is currently visible via IntersectionObserver (threshold 0.7)
- Like/save state managed locally (mirrors existing `myLibraryItems` pattern)
- Props: `videos: LibraryResource[]`, `startIndex: number`, `onClose`, `onBookTutor`, `onAddToLibrary`, `onRemoveFromLibrary`, `myLibraryItems`

### Files to Modify

**`src/components/StudySyncLibrary.tsx`**
- Add state `reelsFeedOpen: boolean` and `reelsStartIndex: number`
- In the Tutorials tab header, add a "Reels" button (Play icon) that opens the feed with all tutorial videos
- When `openResource` is called on a video-type resource, instead of the current `VideoPlayerOverlay`, open `VideoReelsFeed` starting at that video's index in the `recommendedTutorials` array
- Keep `VideoPlayerOverlay` as fallback for non-direct-video resources (e.g., PDFs, books)

**`src/components/library/VideoPlayerOverlay.tsx`**
- No changes needed — kept as fallback for single-video viewing when reels feed isn't appropriate

### UX Details

- Scroll-snap CSS provides the native "snap to next video" feel without external libraries
- IntersectionObserver handles auto-play/pause — only the visible video plays
- On mobile (414px viewport), videos fill the entire screen
- Close button returns to the library view
- "Book Tutor" button on each video slide triggers existing `onBookTutor` flow
- Like count and save status shown on each slide's interaction buttons

### Technical Approach

```text
User taps video card OR "Reels" button
  → VideoReelsFeed opens fullscreen
  → Scrolls to startIndex video
  → IntersectionObserver auto-plays visible video
  → Swipe up → next video snaps into view, auto-plays
  → Tap right-side buttons → like/save/book tutor
  → Tap X → returns to library
```

No new database tables, no new API calls. Uses existing `recommendedTutorials` array from `useLibraryResources`. The interaction tracking (likes, watch time) can be added as a follow-up with a `tutorial_interactions` table.

