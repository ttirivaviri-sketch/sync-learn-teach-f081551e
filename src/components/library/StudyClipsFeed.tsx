import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Heart, Bookmark, GraduationCap, Share2,
  ChevronUp, ChevronDown, BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { LibraryResource } from "@/types/academicProfile";
import { parseVideoSource } from "@/lib/videoUrl";
import { SyncPlayButton } from "@/components/ui/SyncPlayButton";
import { YouTubeClipPlayer } from "@/components/library/YouTubeClipPlayer";


interface StudyClipsFeedProps {
  videos: LibraryResource[];
  startIndex: number;
  onClose: () => void;
  onBookTutor: (tutorId: string, tutorName: string) => void;
  onAddToLibrary: (resourceId: string, resourceTitle: string) => void;
  onRemoveFromLibrary: (resourceId: string) => void;
  myLibraryItems: string[];
  /** Persisted like state + toggle (optional — hides Like when absent). */
  likedItems?: string[];
  onToggleLike?: (resourceId: string) => void;
  /** Feed context label, e.g. "Trigonometry" — shown next to the counter. */
  contextLabel?: string;
  /** Called after a clip has been actively viewed for ~3s (watch signal). */
  onWatch?: (resourceId: string) => void;
}

/* ── helpers ─────────────────────────────────────────────── */

function resolveVideoUrl(r: LibraryResource): string | null {
  if (r.videoUrl) return r.videoUrl;
  const extra = r as unknown as Record<string, unknown>;
  const texts = [r.summary, r.title, extra.description, extra.url].filter(
    (v): v is string => typeof v === "string"
  );
  const urlRe =
    /https?:\/\/[^\s)"']+\.(?:mp4|webm|mov|m4v|ogg)(?:\?[^\s)"']*)?/i;
  const embedRe =
    /https?:\/\/(?:(?:www\.)?youtube\.com\/(?:watch\?[^\s)"']*|shorts\/[^\s)"']*|embed\/[^\s)"']*)|youtu\.be\/[^\s)"']*|(?:www\.)?vimeo\.com\/[^\s)"']*|(?:www\.)?loom\.com\/share\/[^\s)"']*)/i;
  for (const t of texts) {
    const m = t.match(urlRe) || t.match(embedRe);
    if (m) return m[0];
  }
  return null;
}


/* ── single slide ────────────────────────────────────────── */

interface SlideProps {
  resource: LibraryResource;
  isActive: boolean;
  isSaved: boolean;
  isLiked: boolean;
  /** undefined → clip has no bookable tutor; Book button is hidden. */
  onBookTutor?: () => void;
  onToggleSave: () => void;
  onToggleLike?: () => void;
}

function shareClip(resource: LibraryResource, url: string | null) {
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const payload = {
    title: resource.title,
    text: `Watch "${resource.title}" on StudySync`,
    url: shareUrl,
  };
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator.share(payload).catch(() => {});
  } else if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: { title: "Link copied", description: "Clip link copied to clipboard" },
        })
      );
    }).catch(() => {});
  }
}

function ReelSlide({ resource, isActive, isSaved, isLiked, onBookTutor, onToggleSave, onToggleLike }: SlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localLiked, setLocalLiked] = useState(false);
  const liked = onToggleLike ? isLiked : localLiked;
  const [playRequested, setPlayRequested] = useState(false);
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const [playerTimedOut, setPlayerTimedOut] = useState(false);

  const url = resolveVideoUrl(resource);
  const source = url
    ? parseVideoSource(url, {
        origin: typeof window === "undefined" ? undefined : window.location.origin,
      })
    : null;
  // Mount the provider player as soon as the slide is active and let the
  // provider render its own play control — mobile browsers block autoplay,
  // and an extra custom gate only made clips look unplayable.
  const showEmbed = isActive && !!source?.embedUrl;

  useEffect(() => {
    if (isActive) return;
    setPlayRequested(false);
    setPlayerLoaded(false);
    setPlayerTimedOut(false);
    videoRef.current?.pause();
  }, [isActive]);

  useEffect(() => {
    if (!showEmbed || playerLoaded) return;
    const timeout = window.setTimeout(() => setPlayerTimedOut(true), 10000);
    return () => window.clearTimeout(timeout);
  }, [showEmbed, playerLoaded]);

  const requestPlay = () => {
    setPlayerTimedOut(false);
    setPlayRequested(true);
    if (source?.isDirect) {
      window.setTimeout(() => videoRef.current?.play().catch(() => {}), 0);
    }
  };

  const tutorName = resource.tutor?.name || resource.author || "Unknown";
  const tutorId = resource.tutor?.id || "";

  return (
    <div className="h-[100dvh] w-full snap-start relative flex items-center justify-center bg-black shrink-0">
      {/* Video / Embed */}
      {source ? (
        source.provider === "youtube" && source.videoId ? (
          <YouTubeClipPlayer
            videoId={source.videoId}
            title={resource.title}
            isActive={isActive}
            poster={resource.thumbnail}
            watchUrl={source.originalUrl}
            embedUrl={source.embedUrl}
          />
        ) : source.embedUrl ? (
          showEmbed ? (
            <>
            <iframe
              src={source.embedUrl}
              title={resource.title}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen; accelerometer; gyroscope; clipboard-write"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              frameBorder="0"
              onLoad={() => {
                setPlayerLoaded(true);
                setPlayerTimedOut(false);
              }}
            />
            {playerTimedOut && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90 px-8 text-center">
                <p className="text-sm text-white">This video provider did not load in the app.</p>
                <Button asChild variant="secondary" size="sm">
                  <a href={source.originalUrl} target="_blank" rel="noopener noreferrer">Open video</a>
                </Button>
              </div>
            )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              {resource.thumbnail && resource.thumbnail !== "/placeholder.svg" && (
                <img src={resource.thumbnail} alt="" className="absolute inset-0 h-full w-full object-contain" />
              )}
              <div className="absolute inset-0 bg-black/25" />
            </div>
          )


        ) : source.isDirect ? (
          <>
            <video
              ref={videoRef}
              src={source.originalUrl}
              poster={resource.thumbnail !== "/placeholder.svg" ? resource.thumbnail : undefined}
              className="absolute inset-0 w-full h-full object-contain"
              controls={playRequested}
              playsInline
              preload="metadata"
            />
            {!playRequested && isActive && (
              <SyncPlayButton
                size={72}
                className="absolute z-10"
                onClick={requestPlay}
                aria-label={`Play ${resource.title}`}
              />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 px-8 text-center text-white/70">
            <SyncPlayButton decorative size={56} className="opacity-60" />
            <p className="text-sm">This video cannot play inside the app.</p>
            <Button asChild variant="secondary" size="sm">
              <a href={source.originalUrl} target="_blank" rel="noopener noreferrer">Open video</a>
            </Button>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center gap-3 text-white/60">
          <SyncPlayButton decorative size={56} className="opacity-50" />
          <p className="text-sm">No video available</p>
        </div>
      )}


      {/* Right-side interaction buttons */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5 z-20">
        <button
          onClick={() => (onToggleLike ? onToggleLike() : setLocalLiked((l) => !l))}
          className="flex flex-col items-center gap-1"
          aria-label={liked ? "Unlike this clip" : "Like this clip"}
          aria-pressed={liked}
        >
          <Heart
            className={`h-7 w-7 ${liked ? "fill-red-500 text-red-500" : "text-white"}`}
          />
          <span className="text-white text-[10px]">Like</span>
        </button>

        <button
          onClick={onToggleSave}
          className="flex flex-col items-center gap-1"
          aria-label={isSaved ? "Remove from saved" : "Save to library"}
          aria-pressed={isSaved}
        >
          <Bookmark
            className={`h-7 w-7 ${isSaved ? "fill-primary text-primary" : "text-white"}`}
          />
          <span className="text-white text-[10px]">Save</span>
        </button>

        {onBookTutor && (
          <button
            onClick={() => onBookTutor()}
            className="flex flex-col items-center gap-1"
            aria-label="Book this tutor"
          >
            <GraduationCap className="h-7 w-7 text-white" />
            <span className="text-white text-[10px]">Book</span>
          </button>
        )}

        <button
          onClick={() => shareClip(resource, source?.originalUrl ?? null)}
          className="flex flex-col items-center gap-1"
          aria-label="Share this clip"
        >
          <Share2 className="h-7 w-7 text-white" />
          <span className="text-white text-[10px]">Share</span>
        </button>
      </div>

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-14 z-20 p-4 pb-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2 mb-2">
          <Avatar className="h-8 w-8 border border-white/30">
            <AvatarFallback className="text-xs bg-primary/80 text-primary-foreground">
              {tutorName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="text-white text-sm font-medium">{tutorName}</span>
          {tutorName === "studysyncofficial" && (
            <BadgeCheck className="h-4 w-4 text-blue-400 fill-blue-400/30" />
          )}
        </div>
        <h3 className="text-white font-semibold text-sm leading-tight mb-2 line-clamp-2">
          {resource.title}
        </h3>
        <div className="flex flex-wrap gap-1.5">
        {resource.category && (
            <Badge variant="secondary" className="text-[10px] bg-white/20 text-white border-0">
              {resource.category}
            </Badge>
          )}
          {resource.tags?.topic && (
            <Badge variant="secondary" className="text-[10px] bg-white/20 text-white border-0">
              {resource.tags.topic}
            </Badge>
          )}
        </div>
        {source?.embedUrl && (
          <a
            href={source.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-[11px] text-white/70 underline"
          >
            Video not playing? Open it here
          </a>
        )}
      </div>

    </div>
  );
}

/* ── main feed ───────────────────────────────────────────── */

export function StudyClipsFeed({
  videos,
  startIndex,
  onClose,
  onBookTutor,
  onAddToLibrary,
  onRemoveFromLibrary,
  myLibraryItems,
  likedItems,
  onToggleLike,
  contextLabel,
  onWatch,
}: StudyClipsFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(startIndex);

  // Watch signal: a clip counts as "watched" after 3s as the active slide.
  // Each clip fires at most once per feed session.
  const watchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!onWatch) return;
    const video = videos[activeIndex];
    if (!video) return;
    const id = String(video.id);
    if (watchedRef.current.has(id)) return;
    const t = setTimeout(() => {
      watchedRef.current.add(id);
      onWatch(id);
    }, 3000);
    return () => clearTimeout(t);
  }, [activeIndex, videos, onWatch]);

  // Scroll to start index on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const target = el.children[startIndex] as HTMLElement | undefined;
    target?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
  }, [startIndex]);

  // Track active slide from scroll position. Every slide is exactly the
  // container height, so index = round(scrollTop / slideHeight). This stays
  // correct with windowed rendering (placeholder slides swap in/out of the
  // DOM, which would invalidate an IntersectionObserver's observed nodes).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = el.clientHeight;
        if (h <= 0) return;
        const idx = Math.max(
          0,
          Math.min(videos.length - 1, Math.round(el.scrollTop / h))
        );
        setActiveIndex((prev) => (prev === idx ? prev : idx));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, [videos.length]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const toggleSave = useCallback(
    (id: string, title: string) => {
      if (myLibraryItems.includes(id)) {
        onRemoveFromLibrary(id);
      } else {
        onAddToLibrary(id, title);
      }
    },
    [myLibraryItems, onAddToLibrary, onRemoveFromLibrary]
  );

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-30 p-2 rounded-full bg-black/40 backdrop-blur-sm"
        aria-label="Close clips feed"
      >
        <X className="h-6 w-6 text-white" />
      </button>

      {/* Scroll indicator — shows topic context in scoped feeds */}
      <div className="absolute top-4 left-4 z-30 max-w-[70%]">
        <span className="text-white/70 text-xs truncate block">
          {contextLabel ? `${contextLabel} · ` : ""}{activeIndex + 1} of {videos.length}
        </span>
      </div>

      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory scrollbar-none"
      >
        {videos.map((video, idx) => {
          // Windowing: with thousands of clips, mounting every slide
          // (each 100dvh with players/overlays) freezes the app. Only
          // slides near the viewport render for real; the rest are cheap
          // same-height placeholders that keep scroll geometry intact.
          if (Math.abs(idx - activeIndex) > 2) {
            return (
              <div
                key={String(video.id)}
                className="h-[100dvh] w-full snap-start shrink-0 bg-black"
              />
            );
          }
          return (
            <ReelSlide
              key={String(video.id)}
              resource={video}
              isActive={idx === activeIndex}
              isSaved={myLibraryItems.includes(String(video.id))}
              isLiked={!!likedItems?.includes(String(video.id))}
              onBookTutor={
                video.tutor?.id
                  ? () => onBookTutor(video.tutor!.id, video.tutor!.name || video.author || "Tutor")
                  : undefined
              }
              onToggleSave={() => toggleSave(String(video.id), video.title)}
              onToggleLike={
                onToggleLike ? () => onToggleLike(String(video.id)) : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
