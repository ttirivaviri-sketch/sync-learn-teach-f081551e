/**
 * useVideoUpload — React hook for Video Upload & Copyright-Safe Handling
 *
 * Provides:
 *   - submitVideo(): submit a video URL for processing
 *   - videos: list of tutor's video content
 *   - isSubmitting: loading state
 *   - confirmOwnership(): confirm ownership for pending videos
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from "@/utils/logger";
import type {
  VideoUploadRequest,
  VideoUploadResponse,
  VideoContent,
} from '@/sail/types/edgeFunctions';

interface UseVideoUploadReturn {
  videos: VideoContent[];
  isSubmitting: boolean;
  isLoading: boolean;
  error: string | null;
  submitVideo: (request: VideoUploadRequest) => Promise<VideoUploadResponse | null>;
  confirmOwnership: (videoId: string) => Promise<boolean>;
  deleteVideo: (videoId: string) => Promise<boolean>;
  refreshVideos: () => Promise<void>;
  stats: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    totalViews: number;
  };
}

export function useVideoUpload(tutorId?: string): UseVideoUploadReturn {
  const [videos, setVideos] = useState<VideoContent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all videos for this tutor
  const refreshVideos = useCallback(async () => {
    if (!tutorId) return;
    setIsLoading(true);

    try {
      const { data, error: fetchError } = await supabase
        .from('video_content')
        .select('*')
        .eq('tutor_id', tutorId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        // Silently ignore "relation does not exist" for unmigrated DBs
        if (!fetchError.message?.includes('does not exist')) {
          logger.warn('Video fetch error:', fetchError.message);
        }
      } else if (data) {
        setVideos(data as unknown as VideoContent[]);
      }
    } catch (err) {
      logger.warn('Error fetching videos (table may not exist yet):', err);
    } finally {
      setIsLoading(false);
    }
  }, [tutorId]);

  // Submit a new video for processing
  const submitVideo = useCallback(
    async (request: VideoUploadRequest): Promise<VideoUploadResponse | null> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }

        const response = await supabase.functions.invoke('process-video-upload', {
          body: {
            ...request,
            tutor_id: tutorId,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Video processing failed');
        }

        const result = response.data as VideoUploadResponse;

        if (result.status === 'rejected') {
          setError(result.rejection_reason || 'Video rejected');
        }

        // Refresh video list
        await refreshVideos();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        logger.error('Video submission error:', err);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [tutorId, refreshVideos]
  );

  // Confirm ownership for a pending video
  const confirmOwnership = useCallback(
    async (videoId: string): Promise<boolean> => {
      try {
        const { error: updateError } = await supabase
          .from('video_content')
          .update({
            ownership_confirmed: true,
            status: 'approved',
            visibility: 'public',
            updated_at: new Date().toISOString(),
          })
          .eq('id', videoId)
          .eq('tutor_id', tutorId!);

        if (updateError) {
          logger.error('Ownership confirmation error:', updateError);
          return false;
        }

        await refreshVideos();
        return true;
      } catch (err) {
        logger.error('Error confirming ownership:', err);
        return false;
      }
    },
    [tutorId, refreshVideos]
  );

  // Delete a video
  const deleteVideo = useCallback(
    async (videoId: string): Promise<boolean> => {
      try {
        const { error: deleteError } = await supabase
          .from('video_content')
          .delete()
          .eq('id', videoId)
          .eq('tutor_id', tutorId!);

        if (deleteError) {
          logger.error('Video delete error:', deleteError);
          return false;
        }

        setVideos((prev) => prev.filter((v) => v.id !== videoId));
        return true;
      } catch (err) {
        logger.error('Error deleting video:', err);
        return false;
      }
    },
    [tutorId]
  );

  // Load initial data
  useEffect(() => {
    if (tutorId) {
      refreshVideos();
    }
  }, [tutorId, refreshVideos]);

  // Derived stats
  const stats = {
    total: videos.length,
    approved: videos.filter((v) => v.status === 'approved').length,
    pending: videos.filter((v) =>
      ['pending_confirmation', 'pending_review'].includes(v.status)
    ).length,
    rejected: videos.filter((v) => v.status === 'rejected').length,
    totalViews: videos.reduce((sum, v) => sum + v.watch_count, 0),
  };

  return {
    videos,
    isSubmitting,
    isLoading,
    error,
    submitVideo,
    confirmOwnership,
    deleteVideo,
    refreshVideos,
    stats,
  };
}
