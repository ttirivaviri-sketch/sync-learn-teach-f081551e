import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SyncPlayButton } from "@/components/ui/SyncPlayButton";

/* ── YouTube IFrame API loader (single shared promise) ───────── */

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo?: () => void;
  destroy: () => void;
  getPlayerState: () => number;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    options: Record<string, unknown>
  ) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    let settled = false;
    const settle = (ok: boolean, err?: Error) => {
      if (settled) return;
      settled = true;
      if (ok && window.YT?.Player) resolve(window.YT);
      else reject(err ?? new Error("YouTube API unavailable"));
    };
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="youtube.com/iframe_api"]'
    );
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      settle(true);
    };
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => settle(false, new Error("YouTube API failed to load"));
      document.head.appendChild(script);
    }
    // Safety net: poll for the global — some webviews fire the ready callback
    // before we attach, or never fire it at all even though YT loaded fine.
    let attempts = 0;
    const poll = window.setInterval(() => {
      attempts += 1;
      if (window.YT?.Player) {
        window.clearInterval(poll);
        settle(true);
      } else if (attempts >= 40) {
        // ~10s — give up so the caller can fall back to a plain iframe.
        window.clearInterval(poll);
        settle(false, new Error("YouTube API timed out"));
      }
    }, 250);
  }).catch((err) => {
    // Never cache a rejection — a transient network failure must not
    // permanently break every clip until full page reload.
    apiPromise = null;
    throw err;
  });

  return apiPromise;
}

/* ── component ──────────────────────────────────────────────── */

interface YouTubeClipPlayerProps {
  videoId: string;
  title: string;
  /** Only the active slide should own a player. */
  isActive: boolean;
  poster?: string;
  watchUrl: string;
  /** Plain-iframe embed URL used when the IFrame API is unavailable. */
  embedUrl?: string | null;
}

export function YouTubeClipPlayer({
  videoId,
  title,
  isActive,
  poster,
  watchUrl,
  embedUrl,
}: YouTubeClipPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    setReady(false);
    setStarted(false);
    setDismissed(false);
    setFailed(false);
    setUseIframeFallback(false);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        const mount = document.createElement("div");
        mount.className = "absolute inset-0 h-full w-full";
        hostRef.current.replaceChildren(mount);

        playerRef.current = new YT.Player(mount, {
          videoId,
          width: "100%",
          height: "100%",
          host: "https://www.youtube.com",
          playerVars: {
            playsinline: 1,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            fs: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (!cancelled) setReady(true);
            },
            onStateChange: (event: { data: number }) => {
              if (cancelled) return;
              // Only mark started once playback actually begins; pauses and
              // buffering must not re-cover the player with the overlay.
              if (event.data === YT.PlayerState.PLAYING) setStarted(true);
            },
            onError: () => {
              if (!cancelled) setFailed(true);
            },
          },
        });
      })
      .catch(() => {
        // IFrame API unavailable (blocked script, webview quirk, timeout).
        // A plain YouTube embed iframe almost always still works — use it
        // instead of declaring the clip dead.
        if (cancelled) return;
        if (embedUrl) setUseIframeFallback(true);
        else setFailed(true);
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* player already gone */
      }
      playerRef.current = null;
      hostRef.current?.replaceChildren();
    };
  }, [isActive, videoId]);

  // Inactive slide -> poster only, no player, nothing playing in background.
  if (!isActive) {
    return (
      <div className="absolute inset-0 bg-black">
        {poster && poster !== "/placeholder.svg" && (
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-contain opacity-80" />
        )}
      </div>
    );
  }

  // Plain-iframe fallback: the IFrame API could not load, but a standard
  // YouTube embed does not need it. The provider renders its own play button.
  if (useIframeFallback && embedUrl) {
    return (
      <div className="absolute inset-0 bg-black">
        <iframe
          src={embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          frameBorder="0"
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black">
      <div ref={hostRef} className="absolute inset-0" />

      {!started && !dismissed && !failed && (
        <button
          type="button"
          aria-label={`Play ${title}`}
          onClick={() => {
            // Always dismiss the overlay on tap. On iOS/webviews the API's
            // playVideo() is often not honoured as a user gesture inside the
            // iframe — if we keep covering the player until a PLAYING event
            // that may never come, the clip looks dead. Dismissing reveals
            // YouTube's own play button as a guaranteed second tap target.
            setDismissed(true);
            try {
              playerRef.current?.playVideo();
            } catch {
              /* player not ready yet — user can tap YouTube's own button */
            }
          }}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/25"
        >
          {poster && poster !== "/placeholder.svg" && (
            <img src={poster} alt="" className="absolute inset-0 h-full w-full object-contain opacity-80" />
          )}
          <SyncPlayButton decorative size={72} className={ready ? "" : "opacity-50"} />
        </button>
      )}

      {failed && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/90 px-8 text-center">
          <p className="text-sm text-white">This clip can’t play inside the app.</p>
          <Button asChild variant="secondary" size="sm">
            <a href={watchUrl} target="_blank" rel="noopener noreferrer">
              Watch on YouTube
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

export default YouTubeClipPlayer;
