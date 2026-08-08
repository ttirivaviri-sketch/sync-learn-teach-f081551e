import React from "react";
import { parseVideoSource } from "@/lib/videoUrl";

interface VideoEmbedPlayerProps {
  url: string;
  title?: string;
}

export function VideoEmbedPlayer({ url, title = "Video Player" }: VideoEmbedPlayerProps) {
  const source = parseVideoSource(url);

  // 1. Direct video file -> use native <video> player
  if (source.isDirect) {
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
  const embedUrl = source.embedUrl;

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
