export type VideoProvider = "youtube" | "vimeo" | "loom" | "direct" | "unknown";

export interface ParsedVideoSource {
  provider: VideoProvider;
  originalUrl: string;
  embedUrl: string | null;
  isDirect: boolean;
}

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".m4v", ".avi", ".mkv"];
const SAFE_YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;

function directVideoUrl(parsed: URL): boolean {
  const pathname = parsed.pathname.toLowerCase();
  if (VIDEO_EXTENSIONS.some((extension) => pathname.endsWith(extension))) return true;
  if ((parsed.hostname.includes("supabase.co") || parsed.hostname.includes("supabase.in")) && pathname.includes("/storage/")) return true;
  if (parsed.hostname.includes("s3.amazonaws.com")) return true;
  return parsed.searchParams.get("content-type")?.startsWith("video/") === true;
}

function safeYouTubeId(value: string | null | undefined): string | null {
  if (!value || !SAFE_YOUTUBE_ID.test(value)) return null;
  return value;
}

export function parseVideoSource(url: string): ParsedVideoSource {
  const originalUrl = url.trim();

  try {
    const parsed = new URL(originalUrl);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (directVideoUrl(parsed)) {
      return { provider: "direct", originalUrl, embedUrl: null, isDirect: true };
    }

    let youtubeId: string | null = null;
    if (host === "youtu.be") {
      youtubeId = safeYouTubeId(parsed.pathname.split("/").filter(Boolean)[0]);
    } else if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
      if (parsed.pathname === "/watch") {
        youtubeId = safeYouTubeId(parsed.searchParams.get("v"));
      } else {
        const segments = parsed.pathname.split("/").filter(Boolean);
        if (["shorts", "embed", "live"].includes(segments[0] || "")) {
          youtubeId = safeYouTubeId(segments[1]);
        }
      }
    }

    if (youtubeId) {
      return {
        provider: "youtube",
        originalUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?playsinline=1&controls=1&rel=0&modestbranding=1&autoplay=1`,
        isDirect: false,
      };
    }

    if (host.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) {
        return {
          provider: "vimeo",
          originalUrl,
          embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&playsinline=1`,
          isDirect: false,
        };
      }
    }

    if (host.includes("loom.com")) {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const shareIndex = segments.indexOf("share");
      const id = shareIndex >= 0 ? segments[shareIndex + 1] : null;
      if (id && /^[a-zA-Z0-9_-]+$/.test(id)) {
        return {
          provider: "loom",
          originalUrl,
          embedUrl: `https://www.loom.com/embed/${id}?autoplay=1&hide_owner=true&hide_share=true&hide_title=true`,
          isDirect: false,
        };
      }
    }
  } catch {
    // The caller will render an external-link fallback for malformed URLs.
  }

  return { provider: "unknown", originalUrl, embedUrl: null, isDirect: false };
}