import { useState } from 'react';
import { Play, Video } from 'lucide-react';
import type { LibraryResource } from '@/types/academicProfile';
import { useTopicClips } from '../hooks/useTopicClips';
import { StudyClipsFeed } from '@/components/library/StudyClipsFeed';
import { useResourceEngagement } from '@/hooks/useResourceEngagement';

interface TopicClipsRailProps {
  subject: string;
  topic: string;
  curriculum?: string | null;
}

/**
 * "Clips for this topic" — context-aware clip rail inside Study Mode.
 * Shows the most relevant library clips for the subject + current topic
 * (boosted by the learner's weak concepts). Tapping a clip opens the
 * vertical reels player scoped to just these relevant clips.
 */
export function TopicClipsRail({ subject, topic, curriculum }: TopicClipsRailProps) {
  const { clips, loading } = useTopicClips(subject, topic, curriculum);
  const { savedIds, likedIds, toggleSave, toggleLike, recordWatch } = useResourceEngagement();
  const [feedOpen, setFeedOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  if (loading || clips.length === 0) return null;

  const openAt = (idx: number) => {
    setStartIndex(idx);
    setFeedOpen(true);
  };

  return (
    <div className="p-5 rounded-2xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        <Video className="h-4 w-4 text-rose-500" />
        <span className="text-xs font-medium text-muted-foreground">
          Clips for this topic
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {clips.length} clip{clips.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {clips.map((clip: LibraryResource, idx: number) => (
          <button
            key={String(clip.id)}
            onClick={() => openAt(idx)}
            className="group relative w-40 shrink-0 overflow-hidden rounded-xl bg-black shadow-md transition-transform active:scale-[0.98] text-left"
          >
            <div className="relative h-24 w-full">
              <img
                src={clip.thumbnail}
                alt={clip.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover opacity-90"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
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
        ))}
      </div>

      {feedOpen && clips.length > 0 && (
        <StudyClipsFeed
          videos={clips}
          startIndex={startIndex}
          onClose={() => setFeedOpen(false)}
          onBookTutor={() => {}} // seeded clips have no tutor — Book hides itself per-slide
          onAddToLibrary={(id) => toggleSave(id, 'system')}
          onRemoveFromLibrary={(id) => toggleSave(id, 'system')}
          myLibraryItems={savedIds}
          likedItems={likedIds}
          onToggleLike={(id) => toggleLike(id, 'system')}
          contextLabel={topic}
          onWatch={(id) => recordWatch(id, 'system')}
        />
      )}
    </div>
  );
}
