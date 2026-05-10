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

    // YouTube watch URLs (youtube.com, m.youtube.com, www.youtube.com)
    if (host.includes("youtube.com")) {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      // YouTube shorts — extract the video ID from path segment
      if (parsed.pathname.startsWith("/shorts/")) {
        // pathname is "/shorts/4nDIQZ1E8r0" (query params are not in pathname)
        const segments = parsed.pathname.split("/").filter(Boolean);
        const id = segments[1]; // "shorts" is [0], video ID is [1]
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      // YouTube embed URLs (already embeddable)
      if (parsed.pathname.startsWith("/embed/")) {
        return url;
      }

      // YouTube live
      if (parsed.pathname.startsWith("/live/")) {
        const segments = parsed.pathname.split("/").filter(Boolean);
        const id = segments[1];
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
          // If native video fails, replace with link — built via DOM nodes
          // (NOT innerHTML) so untrusted URLs cannot inject HTML/JS.
          const container = (e.target as HTMLVideoElement).parentElement;
          if (!container) return;
          const wrap = document.createElement("div");
          wrap.className = "absolute inset-0 flex flex-col items-center justify-center text-center p-6";
          const p = document.createElement("p");
          p.className = "text-sm text-muted-foreground mb-2";
          p.textContent = "Unable to play this video directly.";
          const a = document.createElement("a");
          a.href = url; // browser sanitizes javascript:/data: in href
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.className = "text-primary underline text-sm";
          a.textContent = "Open video in new tab";
          wrap.append(p, a);
          container.replaceChildren(wrap);
        }}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

export default VideoEmbedPlayer;
