import React from "react";

interface VideoEmbedPlayerProps {
  url: string;
  title?: string;
}

/** Known video file extensions that can be played natively in <video> */
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".m4v", ".avi", ".mkv"];

/**
 * Check if a URL points to a direct video file
 * (Supabase storage, S3, or any direct link to a video file)
 */
const isDirectVideoUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    // Check file extension
    if (VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext))) return true;
    // Common storage patterns: Supabase Storage, S3
    if (parsed.hostname.includes("supabase.co") && pathname.includes("/storage/")) return true;
    if (parsed.hostname.includes("supabase.in") && pathname.includes("/storage/")) return true;
    if (parsed.hostname.includes("s3.amazonaws.com")) return true;
    // Cloudflare R2 / generic storage with video content-type hint in params
    if (parsed.searchParams.get("content-type")?.startsWith("video/")) return true;
    return false;
  } catch {
    return false;
  }
};

const getEmbedUrl = (url: string): string | null => {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    // YouTube watch URLs
    if (host.includes("youtube.com")) {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      // YouTube shorts
      if (parsed.pathname.startsWith("/shorts/")) {
        const id = parsed.pathname.split("/")[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }

    // youtu.be short links
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    // Vimeo
    if (host.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }

    // Loom
    if (host.includes("loom.com") && parsed.pathname.includes("/share/")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.loom.com/embed/${id}` : null;
    }

    return null;
  } catch {
    return null;
  }
};

export function VideoEmbedPlayer({ url, title = "Video Player" }: VideoEmbedPlayerProps) {
  // 1. Direct video file -> use native <video> player
  if (isDirectVideoUrl(url)) {
    return (
      <div className="relative w-full pt-[56.25%]">
        <video
          src={url}
          title={title}
          className="absolute top-0 left-0 w-full h-full rounded-xl bg-black"
          controls
          preload="metadata"
          playsInline
          controlsList="nodownload"
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // 2. Embeddable platform -> use iframe
  const embedUrl = getEmbedUrl(url);

  if (embedUrl) {
    return (
      <div className="relative w-full pt-[56.25%]">
        <iframe
          src={embedUrl}
          title={title}
          className="absolute top-0 left-0 w-full h-full rounded-xl"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  // 3. Unknown URL - try native <video> as fallback before showing error
  return (
    <div className="relative w-full pt-[56.25%]">
      <video
        src={url}
        title={title}
        className="absolute top-0 left-0 w-full h-full rounded-xl bg-black"
        controls
        preload="metadata"
        playsInline
        controlsList="nodownload"
        onError={(e) => {
          // If native video fails, replace with link
          const container = (e.target as HTMLVideoElement).parentElement;
          if (container) {
            container.innerHTML = `
              <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <p class="text-sm text-muted-foreground mb-2">Unable to play this video directly.</p>
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary underline text-sm">
                  Open video in new tab
                </a>
              </div>
            `;
          }
        }}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

export default VideoEmbedPlayer;
