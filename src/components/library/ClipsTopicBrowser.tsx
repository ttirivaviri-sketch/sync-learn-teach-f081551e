import { useMemo, useState } from "react";
import { Play, Sparkles, Video, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AcademicProfile, LibraryResource } from "@/types/academicProfile";
import { buildTopicShelves, type TopicShelf } from "@/lib/clipRelevance";

interface ClipsTopicBrowserProps {
  /** Full clips feed — personalized first (already ordered upstream). */
  clips: LibraryResource[];
  /** Personalized subset (learner's curriculum/grade/subjects). */
  personalizedClips: LibraryResource[];
  academicProfile?: AcademicProfile | null;
  /** Open the vertical reels player scoped to `videos`, starting at `startIndex`. */
  onOpenFeed: (videos: LibraryResource[], startIndex: number) => void;
}

const INITIAL_SHELVES = 12;

function ClipThumb({ clip, onClick }: { clip: LibraryResource; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative w-40 shrink-0 overflow-hidden rounded-xl bg-black shadow-md transition-transform active:scale-[0.98] text-left"
    >
      <div className="relative h-24 w-full">
        <img
          src={clip.thumbnail}
          alt={clip.title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-90"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
            <Play className="h-4 w-4 text-white fill-white" />
          </span>
        </span>
      </div>
      <div className="px-2 py-1.5 bg-card">
        <p className="text-[11px] font-medium leading-snug text-foreground line-clamp-2">
          {clip.title}
        </p>
      </div>
    </button>
  );
}

function ShelfRow({ shelf, onOpenFeed }: { shelf: TopicShelf; onOpenFeed: ClipsTopicBrowserProps["onOpenFeed"] }) {
  return (
    <div className="space-y-2">
      <button
        onClick={() => onOpenFeed(shelf.clips, 0)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <h3 className="font-semibold text-sm truncate">{shelf.topic}</h3>
        <span className="text-xs text-muted-foreground shrink-0">
          · {shelf.subject} · {shelf.clips.length}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
      </button>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {shelf.clips.slice(0, 10).map((clip, idx) => (
          <ClipThumb
            key={String(clip.id)}
            clip={clip}
            onClick={() => onOpenFeed(shelf.clips, idx)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Topic-first Clips browsing — instead of dropping students into a single
 * ~2,000-clip reel, show subject → topic shelves (learner's subjects first).
 * Tapping a shelf or thumbnail opens the reels scoped to just that topic.
 */
export function ClipsTopicBrowser({
  clips,
  personalizedClips,
  academicProfile,
  onOpenFeed,
}: ClipsTopicBrowserProps) {
  const [showAllShelves, setShowAllShelves] = useState(false);

  const shelves = useMemo(
    () => buildTopicShelves(clips, academicProfile?.subjects ?? []),
    [clips, academicProfile],
  );

  const forYou = personalizedClips.slice(0, 10);
  const visibleShelves = showAllShelves ? shelves : shelves.slice(0, INITIAL_SHELVES);

  return (
    <div className="space-y-5">
      {/* For You — personalized quick-start row */}
      {forYou.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => onOpenFeed(personalizedClips, 0)}
            className="flex w-full items-center gap-1.5 text-left"
          >
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <h3 className="font-semibold text-sm">For You</h3>
            <span className="text-xs text-muted-foreground">
              · {personalizedClips.length} clip{personalizedClips.length === 1 ? "" : "s"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
          </button>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
            {forYou.map((clip, idx) => (
              <ClipThumb
                key={String(clip.id)}
                clip={clip}
                onClick={() => onOpenFeed(personalizedClips, idx)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Watch everything — the old firehose, one tap away */}
      <button
        onClick={() => onOpenFeed(clips, 0)}
        className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-md transition-transform active:scale-[0.99]"
        style={{ background: "linear-gradient(135deg, hsl(340 82% 58%), hsl(20 90% 60%))" }}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 shrink-0">
          <Video className="h-4 w-4 text-white" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-white/70">
            All clips
          </span>
          <span className="block text-sm font-semibold text-white truncate">
            Swipe through everything ({clips.length})
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-white/80 shrink-0" />
      </button>

      {/* Topic shelves */}
      {visibleShelves.map((shelf) => (
        <ShelfRow
          key={`${shelf.subject}::${shelf.topic}`}
          shelf={shelf}
          onOpenFeed={onOpenFeed}
        />
      ))}

      {!showAllShelves && shelves.length > INITIAL_SHELVES && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowAllShelves(true)}
        >
          Show {shelves.length - INITIAL_SHELVES} more topics
        </Button>
      )}
    </div>
  );
}
