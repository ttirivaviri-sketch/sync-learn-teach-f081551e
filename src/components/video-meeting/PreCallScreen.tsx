import {
  Video, Mic, Wifi, CheckCircle2, AlertCircle, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PreCallScreenProps {
  subject: string;
  partnerName: string;
  scheduledAt?: string;
  scheduledDuration: number;
  camOk: boolean | null;
  micOk: boolean | null;
  netOk: boolean | null;
  checksDone: boolean;
  onJoin: () => void;
  onRecheck: () => void;
  onCancel: () => void;
}

export function PreCallScreen({
  subject,
  partnerName,
  scheduledAt,
  scheduledDuration,
  camOk,
  micOk,
  netOk,
  checksDone,
  onJoin,
  onRecheck,
  onCancel,
}: PreCallScreenProps) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#1a3fc4] via-[#2d52e0] to-[#3b63f5] flex flex-col items-center justify-center p-6 z-50">
      {/* Logo header */}
      <div className="flex items-center gap-3 mb-8">
        <img src="/lovable-uploads/studysync-logo.png" alt="StudySync" className="h-12 w-auto object-contain mix-blend-screen" />
        <span className="text-3xl font-extrabold tracking-tight">
          <span className="text-white">Study</span><span className="text-green-400">Sync</span>
        </span>
      </div>

      <div className="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-white/20">
        {/* Session info */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 mb-3">
            <Video className="h-4 w-4 text-green-300" />
            <span className="text-white text-sm font-medium">Online Lesson</span>
          </div>
          <h2 className="text-2xl font-bold text-white">{subject}</h2>
          <p className="text-white/70 text-sm mt-1">with {partnerName}</p>
          {scheduledAt && (
            <p className="text-white/60 text-xs mt-1">
              {new Date(scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {scheduledDuration} min
            </p>
          )}
        </div>

        {/* Device checks */}
        <div className="space-y-3 mb-6">
          <p className="text-white/60 text-xs uppercase tracking-wider font-semibold">Device Check</p>
          {[
            { label: "Camera", icon: Video, ok: camOk },
            { label: "Microphone", icon: Mic, ok: micOk },
            { label: "Network", icon: Wifi, ok: netOk },
          ].map(({ label, icon: Icon, ok }) => (
            <div key={label} className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-white/70" />
                <span className="text-white text-sm">{label}</span>
              </div>
              {ok === null ? (
                <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : ok ? (
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-400" />
              )}
            </div>
          ))}
        </div>

        {/* Retry + Join */}
        {checksDone && (
          <div className="space-y-2">
            {(camOk === false || micOk === false) && (
              <Alert className="bg-amber-500/20 border-amber-400/40 text-amber-200 text-xs">
                <AlertDescription>
                  Some devices couldn't be accessed — you can still join but video/audio may be limited.
                </AlertDescription>
              </Alert>
            )}
            <Button
              className="w-full h-12 rounded-2xl bg-green-500 hover:bg-green-400 text-white font-bold text-base shadow-lg"
              onClick={onJoin}
            >
              <Video className="h-5 w-5 mr-2" />
              Join Session
            </Button>
            <Button variant="ghost" className="w-full text-white/60 hover:text-white text-sm" onClick={onRecheck}>
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Re-check devices
            </Button>
          </div>
        )}
      </div>

      <button onClick={onCancel} className="mt-6 text-white/50 hover:text-white/80 text-sm transition-colors">
        Cancel
      </button>
    </div>
  );
}
