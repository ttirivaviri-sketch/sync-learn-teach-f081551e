import { Signal, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface MeetingTopBarProps {
  subject: string;
  partnerName: string;
  connectionQuality: "good" | "poor" | "unknown";
  participantCount: number;
  sessionDuration: number;
  scheduledDuration: number;
  hidden: boolean;
}

export function MeetingTopBar({
  subject,
  partnerName,
  connectionQuality,
  participantCount,
  sessionDuration,
  scheduledDuration,
  hidden,
}: MeetingTopBarProps) {
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const progressPercent = Math.min(100, Math.round((sessionDuration / (scheduledDuration * 60)) * 100));
  const connColor = connectionQuality === "good" ? "text-green-400" : connectionQuality === "poor" ? "text-red-400" : "text-gray-400";
  const connLabel = connectionQuality === "good" ? "Good" : connectionQuality === "poor" ? "Poor signal" : "Connecting…";

  return (
    <div
      className={`absolute top-0 left-0 right-0 z-30 transition-all duration-300 ${
        hidden ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
      >
        <div className="flex items-center gap-3">
          <img src="/lovable-uploads/studysync-logo.png" alt="StudySync" className="h-8 w-auto object-contain mix-blend-screen" />
          <div>
            <p className="text-sm font-semibold leading-tight">{subject}</p>
            <p className="text-xs text-white/60">with {partnerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-black/30 ${connColor}`}>
            <Signal className="h-3 w-3" />{connLabel}
          </span>
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-black/30 text-white">
            <Users className="h-3 w-3" />{participantCount}
          </span>
        </div>
      </div>

      {/* Timer + progress bar */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-3">
          <span className="text-white/80 text-xs font-mono font-medium min-w-[42px]">
            {formatDuration(sessionDuration)}
          </span>
          <div className="flex-1">
            <Progress value={progressPercent} className="h-1 bg-white/20 [&>div]:bg-green-400" />
          </div>
          <span className="text-white/50 text-xs">{scheduledDuration}m</span>
        </div>
      </div>
    </div>
  );
}
