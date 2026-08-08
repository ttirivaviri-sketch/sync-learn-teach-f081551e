import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Heart, Bookmark, GraduationCap, Share2, Play, Pause,
  ChevronUp, ChevronDown, BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { LibraryResource } from "@/types/academicProfile";
import { parseVideoSource } from "@/lib/videoUrl";

interface StudyClipsFeedProps {
  videos: LibraryResource[];
  startIndex: number;
  onClose: () => void;
  onBookTutor: (tutorId: string, tutorName: string) => void;
  onAddToLibrary: (resourceId: string, resourceTitle: string) => void;
  onRemoveFromLibrary: (resourceId: string) => void;
  myLibraryItems: string[];
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
  onBookTutor: () => void;
  onToggleSave: () => void;
}

function ReelSlide({ resource, isActive, isSaved, onBookTutor, onToggleSave }: SlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const [playerTimedOut, setPlayerTimedOut] = useState(false);

  const url = resolveVideoUrl(resource);
  const source = url ? parseVideoSource(url) : null;
  const showEmbed = isActive && playRequested && !!source?.embedUrl;

  useEffect(() => {
    if (isActive) return;
    setPlayRequested(false);
    setPlayerLoaded(false);
    setPlayerTimedOut(false);
    videoRef.current?.pause();
  }, [isActive]);

  useEffect(() => {
    if (!showEmbed || playerLoaded) return;
    const timeout = window.setTimeout(() => setPlayerTimedOut(true), 8000);
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
        source.embedUrl ? (
          showEmbed ? (
            <>
            <iframe
              src={source.embedUrl}
              title={resource.title}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen; accelerometer; gyroscope; clipboard-write; web-share"
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
              {isActive && (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="relative z-10 h-16 w-16 rounded-full shadow-lg"
                  onClick={requestPlay}
                  aria-label={`Play ${resource.title}`}
                >
                  <Play className="h-7 w-7 fill-current" />
                </Button>
              )}
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
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute z-10 h-16 w-16 rounded-full shadow-lg"
                onClick={requestPlay}
                aria-label={`Play ${resource.title}`}
              >
                <Play className="h-7 w-7 fill-current" />
              </Button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 px-8 text-center text-white/70">
            <Play className="h-12 w-12" />
            <p className="text-sm">This video cannot play inside the app.</p>
            <Button asChild variant="secondary" size="sm">
              <a href={source.originalUrl} target="_blank" rel="noopener noreferrer">Open video</a>
            </Button>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center gap-3 text-white/60">
          <Play className="h-12 w-12" />
          <p className="text-sm">No video available</p>
        </div>
      )}


      {/* Right-side interaction buttons */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5 z-20">
        <button
          onClick={() => setLiked((l) => !l)}
          className="flex flex-col items-center gap-1"
        >
          <Heart
            className={`h-7 w-7 ${liked ? "fill-red-500 text-red-500" : "text-white"}`}
          />
          <span className="text-white text-[10px]">Like</span>
        </button>

        <button onClick={onToggleSave} className="flex flex-col items-center gap-1">
          <Bookmark
            className={`h-7 w-7 ${isSaved ? "fill-primary text-primary" : "text-white"}`}
          />
          <span className="text-white text-[10px]">Save</span>
        </button>

        <button
          onClick={() => onBookTutor()}
          className="flex flex-col items-center gap-1"
        >
          <GraduationCap className="h-7 w-7 text-white" />
          <span className="text-white text-[10px]">Book</span>
        </button>

        <button className="flex flex-col items-center gap-1">
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
}: StudyClipsFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(startIndex);

  // Scroll to start index on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const target = el.children[startIndex] as HTMLElement | undefined;
    target?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
  }, [startIndex]);

  // IntersectionObserver to track active slide
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Array.from(el.children).indexOf(entry.target as HTMLElement);
            if (idx >= 0) setActiveIndex(idx);
          }
        }
      },
      { root: el, threshold: 0.7 }
    );
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
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
      >
        <X className="h-6 w-6 text-white" />
      </button>

      {/* Scroll indicator */}
      <div className="absolute top-4 left-4 z-30">
        <span className="text-white/70 text-xs">
          {activeIndex + 1} / {videos.length}
        </span>
      </div>

      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory scrollbar-none"
      >
        {videos.map((video, idx) => (
          <ReelSlide
            key={String(video.id)}
            resource={video}
            isActive={idx === activeIndex}
            isSaved={myLibraryItems.includes(String(video.id))}
            onBookTutor={() => {
              const tid = video.tutor?.id || "";
              const tname = video.tutor?.name || video.author || "Unknown";
              if (tid) onBookTutor(tid, tname);
            }}
            onToggleSave={() => toggleSave(String(video.id), video.title)}
          />
        ))}
      </div>
    </div>
  );
}
