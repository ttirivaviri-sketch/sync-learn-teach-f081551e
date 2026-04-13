import {
  Phone, Mic, MicOff, Video, VideoOff,
  MonitorUp, Hand, PenLine, Maximize2, Minimize2,
} from "lucide-react";

interface MeetingControlBarProps {
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isFullscreen: boolean;
  showNotes: boolean;
  hidden: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleHandRaise: () => void;
  onToggleFullscreen: () => void;
  onToggleNotes: () => void;
  onEndCall: () => void;
}

export function MeetingControlBar({
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  isHandRaised,
  isFullscreen,
  showNotes,
  hidden,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleHandRaise,
  onToggleFullscreen,
  onToggleNotes,
  onEndCall,
}: MeetingControlBarProps) {
  const controlBtn = (active: boolean, activeColor: string, onClick: () => void, title: string, children: React.ReactNode) => (
    <button
      onClick={onClick}
      className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
        active ? `${activeColor} text-white` : "bg-white/15 hover:bg-white/25 text-white"
      }`}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ${
        hidden ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div
        className="px-4 pt-6 pb-5 flex items-center justify-between gap-2"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }}
      >
        {/* Left controls */}
        <div className="flex items-center gap-2">
          {controlBtn(isAudioMuted, "bg-red-500/90 hover:bg-red-500", onToggleAudio, isAudioMuted ? "Unmute" : "Mute",
            isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />
          )}
          {controlBtn(isVideoMuted, "bg-red-500/90 hover:bg-red-500", onToggleVideo, isVideoMuted ? "Start video" : "Stop video",
            isVideoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />
          )}
          {controlBtn(isScreenSharing, "bg-blue-500/90 hover:bg-blue-500", onToggleScreenShare, "Share screen",
            <MonitorUp className="h-5 w-5" />
          )}
        </div>

        {/* Center: End call */}
        <button
          onClick={onEndCall}
          className="h-13 px-7 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center gap-2 text-sm shadow-lg shadow-red-900/40 transition-colors"
        >
          <Phone className="h-5 w-5 rotate-[135deg]" />
          End
        </button>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {controlBtn(isHandRaised, "bg-yellow-500/90 hover:bg-yellow-500", onToggleHandRaise, "Raise hand",
            <Hand className="h-5 w-5" />
          )}
          {controlBtn(showNotes, "bg-blue-500/90 hover:bg-blue-500", onToggleNotes, "Session notes",
            <PenLine className="h-5 w-5" />
          )}
          <button
            onClick={onToggleFullscreen}
            className="h-11 w-11 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 text-white transition-colors"
            title="Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
