/**
 * LearningCompanion — the "sentient" study companion card.
 *
 * Speaks to the student about what they're studying right now:
 *   "I see you're struggling with Photosynthesis — here's a video by
 *    CrashCourse that breaks it down beautifully."
 *
 * Powered by useCompanionRecommendations (learner_state + homework +
 * library + tutors). Renders one suggestion at a time with a typewriter
 * animation, lets the student page through the rest, play videos inline,
 * open books, or book the suggested tutor. Each suggestion is dismissable
 * for the day (localStorage).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  X,
  PlayCircle,
  BookOpen,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VideoEmbedPlayer } from "@/components/VideoEmbedPlayer";
import {
  useCompanionRecommendations,
  type CompanionSuggestion,
  type CompanionMood,
} from "@/hooks/useCompanionRecommendations";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

interface Props {
  userId: string | null | undefined;
  /** Book the suggested tutor (same contract as library booking). */
  onBookTutor?: (tutorId: string, tutorName: string) => void;
  /** Optional: jump to the Library tab pre-filtered by topic. */
  onOpenLibrary?: (topic: string) => void;
  className?: string;
}

// ── Mood styling ─────────────────────────────────────────────────────────────

const MOOD_STYLES: Record<CompanionMood, { ring: string; chip: string; label: string }> = {
  concern: {
    ring: "border-amber-500/25 from-amber-500/10",
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    label: "Noticed something",
  },
  homework: {
    ring: "border-sky-500/25 from-sky-500/10",
    chip: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    label: "Homework radar",
  },
  encourage: {
    ring: "border-emerald-500/25 from-emerald-500/10",
    chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    label: "You're on a roll",
  },
  tutor: {
    ring: "border-violet-500/25 from-violet-500/10",
    chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    label: "A human can help",
  },
};

// ── Typewriter ───────────────────────────────────────────────────────────────

function useTypewriter(text: string, speedMs = 18) {
  const [shown, setShown] = useState("");
  const reduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  );

  useEffect(() => {
    if (reduced.current) {
      setShown(text);
      return;
    }
    setShown("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 2; // two chars per tick keeps it lively
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speedMs);
    return () => window.clearInterval(id);
  }, [text, speedMs]);

  return { shown, done: shown.length >= text.length };
}

// ── Dismissal (per-suggestion, per-day) ─────────────────────────────────────

function dismissKey() {
  return `companion-dismissed:${new Date().toISOString().slice(0, 10)}`;
}

function readDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(dismissKey()) ?? "[]"));
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(dismissKey(), JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function LearningCompanion({ userId, onBookTutor, onOpenLibrary, className }: Props) {
  const { data: all = [], isLoading } = useCompanionRecommendations(userId);
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());
  const [index, setIndex] = useState(0);
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null);

  const suggestions = useMemo(
    () =>
      all.filter(
        (s) =>
          !dismissed.has(s.id) &&
          // Tutor suggestions need a booking handler to be actionable.
          (!s.tutor || !!onBookTutor)
      ),
    [all, dismissed, onBookTutor]
  );

  // Keep index in range as suggestions get dismissed.
  const safeIndex = Math.min(index, Math.max(0, suggestions.length - 1));
  const current: CompanionSuggestion | undefined = suggestions[safeIndex];

  const { shown, done } = useTypewriter(current?.message ?? "");

  if (isLoading || !current) return null;

  const mood = MOOD_STYLES[current.mood];

  const dismiss = () => {
    haptic("selection");
    const next = new Set(dismissed);
    next.add(current.id);
    setDismissed(next);
    writeDismissed(next);
  };

  const openResource = () => {
    haptic("light");
    const r = current.resource;
    if (!r) return;
    if (r.kind === "video") {
      setPlayingVideo({ url: r.url, title: r.title });
    } else {
      window.open(r.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border bg-gradient-to-br to-transparent p-4 shadow-sm animate-fade-in",
          mood.ring,
          className
        )}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 mb-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground leading-none">Study Companion</p>
            <span className={cn("inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium", mood.chip)}>
              {mood.label}
            </span>
          </div>
          {suggestions.length > 1 && (
            <div className="flex items-center gap-0.5 text-muted-foreground">
              <button
                type="button"
                aria-label="Previous suggestion"
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-background/60 disabled:opacity-30"
                disabled={safeIndex === 0}
                onClick={() => { haptic("selection"); setIndex((i) => Math.max(0, i - 1)); }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[10px] tabular-nums">
                {safeIndex + 1}/{suggestions.length}
              </span>
              <button
                type="button"
                aria-label="Next suggestion"
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-background/60 disabled:opacity-30"
                disabled={safeIndex >= suggestions.length - 1}
                onClick={() => { haptic("selection"); setIndex((i) => Math.min(suggestions.length - 1, i + 1)); }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <button
            type="button"
            aria-label="Dismiss suggestion"
            onClick={dismiss}
            className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-background/60 text-muted-foreground shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Sentient message with typewriter effect */}
        <p className="text-sm leading-relaxed text-foreground min-h-[2.5rem]">
          {shown}
          {!done && <span className="inline-block w-[2px] h-[1em] bg-primary/70 ml-0.5 align-middle animate-pulse" />}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">{current.reason}</p>

        {/* Resource preview */}
        {current.resource && (
          <button
            type="button"
            onClick={openResource}
            className="mt-3 w-full flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-2.5 text-left transition-all hover:shadow-md active:scale-[0.99]"
          >
            {current.resource.thumbnail ? (
              <img
                src={current.resource.thumbnail}
                alt=""
                loading="lazy"
                className="h-12 w-20 rounded-lg object-cover shrink-0 bg-muted"
              />
            ) : (
              <span className="h-12 w-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                {current.resource.kind === "video" ? (
                  <PlayCircle className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                )}
              </span>
            )}
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-foreground truncate">
                {current.resource.title}
              </span>
              <span className="block text-[11px] text-muted-foreground truncate">
                {current.resource.kind === "video" ? "Video" : "Book"} · {current.resource.author}
                {current.resource.topic ? ` · ${current.resource.topic}` : ""}
              </span>
            </span>
            {current.resource.kind === "video" ? (
              <PlayCircle className="h-5 w-5 text-primary shrink-0" />
            ) : (
              <ExternalLink className="h-4 w-4 text-primary shrink-0" />
            )}
          </button>
        )}

        {/* Tutor preview */}
        {current.tutor && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-2.5">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={current.tutor.avatarUrl ?? "/placeholder.svg"} />
              <AvatarFallback className="text-xs">
                {current.tutor.name.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-foreground truncate">{current.tutor.name}</p>
                {current.tutor.online && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px] gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Online
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {current.tutor.subject}
                {current.tutor.level ? ` · ${current.tutor.level}` : ""}
                {current.tutor.hourlyRate ? ` · R${current.tutor.hourlyRate}/hour` : ""}
              </p>
            </div>
            <Button
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={() => {
                haptic("light");
                onBookTutor?.(current.tutor!.id, current.tutor!.name);
              }}
            >
              <CalendarPlus className="h-3.5 w-3.5 mr-1" />
              Book
            </Button>
          </div>
        )}

        {/* Secondary: explore more on this topic in the Library */}
        {onOpenLibrary && (
          <button
            type="button"
            onClick={() => { haptic("selection"); onOpenLibrary(current.topic); }}
            className="mt-2.5 text-[11px] font-medium text-primary hover:underline"
          >
            More on {current.topic} in the Library →
          </button>
        )}
      </div>

      {/* Inline video player */}
      <Dialog open={!!playingVideo} onOpenChange={(open) => !open && setPlayingVideo(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-sm pr-8">{playingVideo?.title}</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            {playingVideo && <VideoEmbedPlayer url={playingVideo.url} title={playingVideo.title} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
