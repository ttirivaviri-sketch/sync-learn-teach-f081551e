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
    const ready = () => {
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube API unavailable"));
    };
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="youtube.com/iframe_api"]'
    );
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      ready();
    };
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("YouTube API failed to load"));
      document.head.appendChild(script);
    }
    // Safety net: some webviews fire the global before we attach.
    window.setTimeout(() => {
      if (window.YT?.Player) resolve(window.YT);
    }, 4000);
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
}

export function YouTubeClipPlayer({
  videoId,
  title,
  isActive,
  poster,
  watchUrl,
}: YouTubeClipPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    setReady(false);
    setStarted(false);
    setFailed(false);

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
              setPlaying(event.data === YT.PlayerState.PLAYING);
            },
            onError: () => {
              if (!cancelled) setFailed(true);
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
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

  return (
    <div className="absolute inset-0 bg-black">
      <div ref={hostRef} className="absolute inset-0" />

      {!playing && !failed && (
        <button
          type="button"
          aria-label={`Play ${title}`}
          onClick={() => {
            try {
              playerRef.current?.playVideo();
            } catch {
              setFailed(true);
            }
          }}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/25"
        >
          {poster && poster !== "/placeholder.svg" && (
            <img src={poster} alt="" className="absolute inset-0 h-full w-full object-contain -z-10" />
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
