import { Mic } from "lucide-react";
import type { CaptionLine } from "@/hooks/useLiveLessonTranscript";

interface Props {
  lines: CaptionLine[];
  isRecording: boolean;
}

const SPEAKER_STYLES: Record<string, string> = {
  tutor: "bg-primary/30 text-primary-foreground border-primary/50",
  learner: "bg-accent/30 text-accent-foreground border-accent/50",
  unknown: "bg-white/10 text-white/80 border-white/20",
};

const SPEAKER_LABEL: Record<string, string> = {
  tutor: "Tutor", learner: "Learner", unknown: "Speaker",
};

/**
 * Floating live-captions strip rendered over the Jitsi call surface. Shows the
 * last two diarised lines with a coloured speaker chip per line.
 */
export function LiveCaptionsOverlay({ lines, isRecording }: Props) {
  if (!isRecording) return null;
  const visible = lines.slice(-2);
  return (
    <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-[90%] pointer-events-none">
      <div className="flex flex-col gap-1.5 bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 text-white">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-emerald-300">
          <Mic className="h-3 w-3 animate-pulse" /> Live captions
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-white/70 italic">Listening…</p>
        ) : visible.map((l, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${SPEAKER_STYLES[l.speaker]}`}>
              {SPEAKER_LABEL[l.speaker]}
            </span>
            <p className="text-sm leading-relaxed line-clamp-2">{l.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
