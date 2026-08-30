import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { logger } from '@/utils/logger';
import type { LibraryResource } from '@/types/academicProfile';
import { subjectAliases } from '@/lib/personalization';
import { rankClipsForContext } from '@/lib/clipRelevance';
import { useWeakConcepts } from './useWeakConcepts';

/**
 * Context-aware clips for Study Mode: fetches library clips for the
 * subject being studied (alias-tolerant), then ranks them by relevance
 * to the current topic and the learner's weak concepts.
 *
 * Lean by design — one indexed query per subject, cached 10 min.
 */

function mapRowToResource(row: Record<string, unknown>): LibraryResource {
  const gradeLevels = Array.isArray(row.grade_levels) ? (row.grade_levels as string[]) : [];
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    author: (row.curriculum as string) ?? 'StudySync',
    type: 'video',
    category: (row.subject as string) || 'General',
    gradeLevel: gradeLevels.join(' • ') || 'All Grades',
    summary: (row.description as string) || '',
    rating: 0,
    reviews: Number(row.view_count ?? 0),
    thumbnail: (row.thumbnail_url as string) || '/placeholder.svg',
    isOffline: false,
    duration: 'Video',
    isTutorial: true,
    videoUrl: (row.video_url as string) || undefined,
    tags: {
      subject: (row.subject as string) || 'General',
      topic: (row.topic as string) || 'All Topics',
      grade: gradeLevels[0] || 'All Grades',
      curriculum: (row.curriculum as string) ?? null,
    },
  } as LibraryResource;
}

export function useTopicClips(
  subject: string | undefined,
  topic: string | undefined,
  curriculum?: string | null,
  limit = 10,
) {
  const { weakConcepts } = useWeakConcepts(subject, curriculum ?? undefined);

  const query = useQuery({
    queryKey: ['topic_clips', subject],
    enabled: !!subject,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<LibraryResource[]> => {
      if (!subject) return [];
      const aliases = subjectAliases(subject);
      if (aliases.length === 0) return [];
      // ilike with no wildcard = case-insensitive equality; OR across aliases.
      const orFilter = aliases.map((a) => `subject.ilike.${a}`).join(',');
      const { data, error } = await supabase
        .from('library_system_resources')
        .select('id, title, subject, topic, description, video_url, thumbnail_url, grade_levels, curriculum, view_count')
        .eq('kind', 'video')
        .or(orFilter)
        .limit(600);
      if (error) {
        logger.warn('[useTopicClips] fetch failed', error.message);
        return [];
      }
      return ((data as Record<string, unknown>[]) ?? [])
        .filter((r) => !!r.video_url)
        .map(mapRowToResource);
    },
  });

  const subjectClips = query.data ?? [];
  const weakLabels = (weakConcepts ?? []).map((w) => w.concept);
  const clips = rankClipsForContext(
    subjectClips,
    { subject, topic, weakConcepts: weakLabels },
    limit,
  );

  return { clips, allSubjectClips: subjectClips, loading: query.isLoading };
}
