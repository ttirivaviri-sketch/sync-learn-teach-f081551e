import { Video } from "lucide-react";
import { forwardRef } from "react";

interface ConnectingScreenProps {
  partnerName: string;
}

export const ConnectingScreen = forwardRef<HTMLDivElement, ConnectingScreenProps>(
  ({ partnerName }, ref) => {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#1a3fc4] via-[#2d52e0] to-[#3b63f5] flex flex-col items-center justify-center gap-6 z-50">
        <img src="/lovable-uploads/studysync-logo.png" alt="StudySync" className="h-16 mix-blend-screen animate-pulse" />
        <div>
          <div className="relative h-16 w-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-white/20" />
            <div className="absolute inset-0 rounded-full border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <Video className="absolute inset-0 m-auto h-6 w-6 text-white/80" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-white text-lg font-semibold">Setting up your session…</p>
          <p className="text-white/60 text-sm mt-1">Connecting to {partnerName}</p>
        </div>
        {/* Hidden Jitsi container mounts here */}
        <div ref={ref} className="hidden" />
      </div>
    );
  }
);

ConnectingScreen.displayName = "ConnectingScreen";
