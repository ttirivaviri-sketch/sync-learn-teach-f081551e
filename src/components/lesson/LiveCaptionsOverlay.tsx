import { Mic } from "lucide-react";

interface Props {
  caption: string;
  isRecording: boolean;
}

/**
 * Floating live-captions strip rendered over the Jitsi call surface. Shows the
 * most recent transcribed sentence from Gemini-based live transcription.
 */
export function LiveCaptionsOverlay({ caption, isRecording }: Props) {
  if (!isRecording) return null;
  return (
    <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-[90%] pointer-events-none">
      <div className="flex items-start gap-2 bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 text-white">
        <Mic className="h-4 w-4 mt-0.5 text-emerald-400 shrink-0 animate-pulse" />
        <p className="text-sm leading-relaxed line-clamp-3 min-h-[1.25rem]">
          {caption || "Listening…"}
        </p>
      </div>
    </div>
  );
}
