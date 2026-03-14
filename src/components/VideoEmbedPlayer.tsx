import React from "react";

interface VideoEmbedPlayerProps {
  url: string;
  title?: string;
}

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
  const embedUrl = getEmbedUrl(url);

  if (!embedUrl) {
    return (
      <div className="text-center p-6">
        <p className="text-sm text-muted-foreground">Unable to embed this video.</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline text-sm"
        >
          Open video in new tab
        </a>
      </div>
    );
  }

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

export default VideoEmbedPlayer;
