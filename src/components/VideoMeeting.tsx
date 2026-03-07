import { useState, useEffect, useRef } from "react";
import {
  Phone, Mic, MicOff, Video, VideoOff, Users, Signal,
  MonitorUp, Hand, MessageSquare, ChevronDown, ChevronUp,
  Clock, BookOpen, Star, X, CheckCircle2, AlertCircle,
  Wifi, WifiOff, Settings, Maximize2, Minimize2, PenLine,
  BookMarked, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

interface VideoMeetingProps {
  sessionType: "tutor" | "learner";
  partnerName: string;
  subject: string;
  booking?: any;
  onEndCall: () => void;
}

type Screen = "precall" | "connecting" | "meeting" | "summary";

const VideoMeeting = ({ sessionType, partnerName, subject, booking, onEndCall }: VideoMeetingProps) => {
  const { toast } = useToast();
  const jitsiContainer = useRef<HTMLDivElement>(null);
  const jitsiApi = useRef<any>(null);

  // Screen state
  const [screen, setScreen] = useState<Screen>("precall");

  // Pre-call device checks
  const [camOk, setCamOk]   = useState<boolean | null>(null);
  const [micOk, setMicOk]   = useState<boolean | null>(null);
  const [netOk, setNetOk]   = useState<boolean | null>(null);
  const [checksDone, setChecksDone] = useState(false);

  // Session timing
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const scheduledDuration = booking?.duration_minutes || 60; // minutes

  // Meeting state
  const [isLoading, setIsLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(1);
  const [connectionQuality, setConnectionQuality] = useState<"good" | "poor" | "unknown">("unknown");
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Summary / end-call
  const [rating, setRating] = useState(0);
  const [summaryNotes, setSummaryNotes] = useState("");

  // Auto-hide controls timer
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Timer ───────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "meeting" || !sessionStartTime) return;
    const timer = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - sessionStartTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [screen, sessionStartTime]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const progressPercent = Math.min(
    100,
    Math.round((sessionDuration / (scheduledDuration * 60)) * 100)
  );

  // ─── Pre-call device checks ───────────────────────────────
  useEffect(() => {
    if (screen !== "precall") return;
    runChecks();
  }, [screen]);

  const runChecks = async () => {
    setCamOk(null); setMicOk(null); setNetOk(null); setChecksDone(false);

    // Network check
    const online = navigator.onLine;
    setTimeout(() => setNetOk(online), 400);

    // Camera + mic
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(t => t.stop());
      setTimeout(() => setCamOk(true), 700);
      setTimeout(() => setMicOk(true), 1000);
    } catch (e: any) {
      const isCam = e.name !== "NotFoundError";
      setTimeout(() => setCamOk(!isCam ? false : true), 700);
      setTimeout(() => setMicOk(false), 1000);
    }

    setTimeout(() => setChecksDone(true), 1400);
  };

  // ─── Jitsi init ───────────────────────────────────────────
  const initSession = async () => {
    setScreen("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch (e: any) {
      let msg = "Camera and microphone access denied.";
      if (e.name === "NotFoundError") msg = "No camera or microphone detected.";
      if (e.name === "NotReadableError") msg = "Camera/mic already in use by another app.";
      setPermissionError(msg);
      setScreen("meeting");
      setIsLoading(false);
      return;
    }

    const loadAndInit = () => {
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = () => initJitsi();
      script.onerror = () => {
        setIsLoading(false);
        setScreen("meeting");
        toast({ title: "Connection Failed", description: "Unable to load video service.", variant: "destructive" });
      };
      document.body.appendChild(script);
    };

    if (window.JitsiMeetExternalAPI) {
      initJitsi();
    } else {
      loadAndInit();
    }
  };

  const initJitsi = () => {
    if (!jitsiContainer.current || jitsiApi.current) return;

    const roomName = booking?.room_name || `StudySync-${booking?.id || "demo-session"}`;
    const displayName = sessionType === "tutor" ? `Tutor` : `Learner`;

    try {
      jitsiApi.current = new window.JitsiMeetExternalAPI("meet.jit.si", {
        roomName,
        width: "100%",
        height: "100%",
        parentNode: jitsiContainer.current,
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          enableNoisyMicDetection: true,
          enableNoAudioDetection: true,
          enableClosePage: false,
          p2p: {
            enabled: true,
            stunServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
            ],
          },
          resolution: 720,
          constraints: {
            video: { height: { ideal: 720, max: 1080, min: 360 }, width: { ideal: 1280, max: 1920, min: 640 } },
          },
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          TOOLBAR_BUTTONS: [],  // We use our own controls
          DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
        },
        userInfo: { displayName },
      });

      jitsiApi.current.addEventListener("videoConferenceJoined", () => {
        setIsLoading(false);
        setScreen("meeting");
        setSessionStartTime(new Date());
        toast({ title: "Connected ✓", description: "You've joined the session." });
      });

      jitsiApi.current.addEventListener("participantJoined", (p: any) => {
        setParticipantCount(c => c + 1);
        toast({ title: "Joined", description: `${p.displayName || "Someone"} joined the session.` });
      });

      jitsiApi.current.addEventListener("participantLeft", (p: any) => {
        setParticipantCount(c => Math.max(1, c - 1));
        toast({ title: "Left", description: `${p.displayName || "Someone"} left the session.` });
      });

      jitsiApi.current.addEventListener("audioMuteStatusChanged", (e: any) => setIsAudioMuted(e.muted));
      jitsiApi.current.addEventListener("videoMuteStatusChanged", (e: any) => setIsVideoMuted(e.muted));
      jitsiApi.current.addEventListener("screenSharingStatusChanged", (e: any) => setIsScreenSharing(e.on));

      jitsiApi.current.addEventListener("participantConnectionStatusChanged", (e: any) => {
        setConnectionQuality(e.connectionQuality === "good" || e.connectionQuality > 50 ? "good" : "poor");
      });

      jitsiApi.current.addEventListener("readyToClose", handleEndCall);

      jitsiApi.current.addEventListener("errorOccurred", (e: any) => {
        toast({ title: "Connection Error", description: e.message || "Video error occurred.", variant: "destructive" });
      });

      // 30s connection timeout
      setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          setScreen("meeting");
        }
      }, 30000);
    } catch (e) {
      setIsLoading(false);
      setScreen("meeting");
      toast({ title: "Initialization Failed", description: "Failed to start video. Please refresh.", variant: "destructive" });
    }
  };

  // ─── Controls ─────────────────────────────────────────────
  const handleEndCall = () => {
    if (jitsiApi.current) {
      jitsiApi.current.dispose();
      jitsiApi.current = null;
    }
    setSummaryNotes(notes);
    setScreen("summary");
  };

  const toggleAudio = () => jitsiApi.current?.executeCommand("toggleAudio");
  const toggleVideo = () => jitsiApi.current?.executeCommand("toggleVideo");
  const toggleScreenShare = () => jitsiApi.current?.executeCommand("toggleShareScreen");

  const toggleHandRaise = () => {
    jitsiApi.current?.executeCommand("toggleRaiseHand");
    setIsHandRaised(r => !r);
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(f => !f);
  };

  // Auto-hide controls after 4s inactivity
  const resetHideTimer = () => {
    setControlsHidden(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsHidden(true), 4000);
  };

  useEffect(() => {
    if (screen !== "meeting") return;
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [screen]);

  const connColor = connectionQuality === "good" ? "text-green-400" : connectionQuality === "poor" ? "text-red-400" : "text-gray-400";
  const connLabel = connectionQuality === "good" ? "Good" : connectionQuality === "poor" ? "Poor signal" : "Connecting…";

  // ─── PRE-CALL SCREEN ──────────────────────────────────────
  if (screen === "precall") {
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
            {booking?.scheduled_at && (
              <p className="text-white/60 text-xs mt-1">
                {new Date(booking.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {scheduledDuration} min
              </p>
            )}
          </div>

          {/* Device checks */}
          <div className="space-y-3 mb-6">
            <p className="text-white/60 text-xs uppercase tracking-wider font-semibold">Device Check</p>
            {[
              { label: "Camera", icon: Video,   ok: camOk },
              { label: "Microphone", icon: Mic, ok: micOk },
              { label: "Network",  icon: Wifi,  ok: netOk },
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
                onClick={initSession}
              >
                <Video className="h-5 w-5 mr-2" />
                Join Session
              </Button>
              <Button
                variant="ghost"
                className="w-full text-white/60 hover:text-white text-sm"
                onClick={runChecks}
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Re-check devices
              </Button>
            </div>
          )}
        </div>

        {/* Cancel */}
        <button onClick={onEndCall} className="mt-6 text-white/50 hover:text-white/80 text-sm transition-colors">
          Cancel
        </button>
      </div>
    );
  }

  // ─── CONNECTING SCREEN ────────────────────────────────────
  if (screen === "connecting") {
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
        <div ref={jitsiContainer} className="hidden" />
      </div>
    );
  }

  // ─── END-CALL SUMMARY ─────────────────────────────────────
  if (screen === "summary") {
    const durationMins = Math.ceil(sessionDuration / 60);
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#1a3fc4] via-[#2d52e0] to-[#3b63f5] flex flex-col items-center justify-center p-6 z-50 overflow-y-auto">
        <div className="w-full max-w-sm space-y-5">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-400/20 border-2 border-green-400/40 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
            <p className="text-white/70 text-sm mt-1">{subject} with {partnerName}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Duration", value: `${durationMins} min`, icon: Clock },
              { label: "Subject", value: subject, icon: BookOpen },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white/10 backdrop-blur rounded-2xl p-4 text-center border border-white/15">
                <Icon className="h-5 w-5 text-white/60 mx-auto mb-1" />
                <p className="text-white font-bold text-lg leading-tight">{value}</p>
                <p className="text-white/50 text-xs">{label}</p>
              </div>
            ))}
          </div>

          {/* Rating */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15">
            <p className="text-white/70 text-sm mb-3 font-medium">How was the session?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRating(n)} className="focus:outline-none transform hover:scale-110 transition-transform">
                  <Star className={`h-8 w-8 ${n <= rating ? "text-yellow-400 fill-yellow-400" : "text-white/30"}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          {summaryNotes && (
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15">
              <div className="flex items-center gap-2 mb-2">
                <BookMarked className="h-4 w-4 text-white/60" />
                <p className="text-white/70 text-sm font-medium">Session Notes</p>
              </div>
              <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{summaryNotes}</p>
            </div>
          )}

          <Button
            className="w-full h-12 rounded-2xl bg-white text-[#1a3fc4] font-bold text-base hover:bg-white/90"
            onClick={onEndCall}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  // ─── MEETING SCREEN ───────────────────────────────────────
  return (
    <div
      className="fixed inset-0 flex flex-col bg-[#0d0d1a] overflow-hidden"
      onPointerMove={resetHideTimer}
      onPointerDown={resetHideTimer}
    >
      {/* ── Top Bar ── */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 transition-all duration-300 ${controlsHidden ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"}`}
      >
        <div
          className="flex items-center justify-between px-4 py-3 text-white"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
        >
          {/* Left: logo + session info */}
          <div className="flex items-center gap-3">
            <img src="/lovable-uploads/studysync-logo.png" alt="StudySync" className="h-8 w-auto object-contain mix-blend-screen" />
            <div>
              <p className="text-sm font-semibold leading-tight">{subject}</p>
              <p className="text-xs text-white/60">with {partnerName}</p>
            </div>
          </div>

          {/* Right: badges */}
          <div className="flex items-center gap-1.5">
            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-black/30 ${connColor}`}>
              <Signal className="h-3 w-3" />{connLabel}
            </span>
            <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-black/30 text-white">
              <Users className="h-3 w-3" />{participantCount}
            </span>
          </div>
        </div>

        {/* Session timer + progress bar */}
        <div className="px-4 pb-2" style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0) 100%)" }}>
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

      {/* ── Permission Error ── */}
      {permissionError && (
        <div className="absolute top-16 left-4 right-4 z-40">
          <Alert variant="destructive" className="border-red-500/50 bg-red-950/80 text-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
              <span>{permissionError}</span>
              <Button size="sm" variant="outline" className="border-red-400/50 text-red-200 hover:bg-red-900/50" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* ── Waiting banner ── */}
      {!isLoading && participantCount === 1 && !permissionError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 w-full max-w-xs px-4">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur border border-white/10 rounded-2xl px-4 py-3 text-white/80">
            <div className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </div>
            <p className="text-sm">Waiting for {sessionType === "tutor" ? "learner" : "your tutor"} to join…</p>
          </div>
        </div>
      )}

      {/* ── Loading overlay ── */}
      {isLoading && !permissionError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d1a] z-10 gap-4">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <Video className="absolute inset-0 m-auto h-6 w-6 text-white/60" />
          </div>
          <div className="text-center">
            <p className="text-white font-medium">Joining session…</p>
            <p className="text-white/40 text-sm mt-1">Allow camera & mic access when prompted</p>
          </div>
        </div>
      )}

      {/* ── Jitsi container ── */}
      <div className="flex-1 relative w-full overflow-hidden">
        <div ref={jitsiContainer} className="w-full h-full" />
      </div>

      {/* ── Side: Session Notes panel ── */}
      {showNotes && (
        <div className="absolute right-0 top-0 bottom-20 w-72 bg-[#0d0d1a]/95 border-l border-white/10 z-25 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-white">
              <PenLine className="h-4 w-4" />
              <span className="text-sm font-medium">Session Notes</span>
            </div>
            <button onClick={() => setShowNotes(false)} className="text-white/40 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <Textarea
            className="flex-1 m-3 bg-white/5 border-white/10 text-white/90 text-sm placeholder:text-white/30 resize-none rounded-xl focus-visible:ring-blue-500/50"
            placeholder={`Jot down key points from the ${subject} session…`}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <p className="text-white/30 text-xs text-center pb-3">Notes are saved locally and shown after the call</p>
        </div>
      )}

      {/* ── Bottom Control Bar ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ${controlsHidden ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"}`}
      >
        <div
          className="px-4 pt-6 pb-5 flex items-center justify-between gap-2"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }}
        >
          {/* Left controls */}
          <div className="flex items-center gap-2">
            {/* Mic */}
            <button
              onClick={toggleAudio}
              className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
                isAudioMuted
                  ? "bg-red-500/90 hover:bg-red-500 text-white"
                  : "bg-white/15 hover:bg-white/25 text-white"
              }`}
              title={isAudioMuted ? "Unmute" : "Mute"}
            >
              {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            {/* Camera */}
            <button
              onClick={toggleVideo}
              className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
                isVideoMuted
                  ? "bg-red-500/90 hover:bg-red-500 text-white"
                  : "bg-white/15 hover:bg-white/25 text-white"
              }`}
              title={isVideoMuted ? "Start video" : "Stop video"}
            >
              {isVideoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </button>

            {/* Screen share */}
            <button
              onClick={toggleScreenShare}
              className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
                isScreenSharing
                  ? "bg-blue-500/90 hover:bg-blue-500 text-white"
                  : "bg-white/15 hover:bg-white/25 text-white"
              }`}
              title="Share screen"
            >
              <MonitorUp className="h-5 w-5" />
            </button>
          </div>

          {/* Center: End call */}
          <button
            onClick={handleEndCall}
            className="h-13 px-7 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center gap-2 text-sm shadow-lg shadow-red-900/40 transition-colors"
          >
            <Phone className="h-5 w-5 rotate-[135deg]" />
            End
          </button>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Raise hand */}
            <button
              onClick={toggleHandRaise}
              className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
                isHandRaised
                  ? "bg-yellow-500/90 hover:bg-yellow-500 text-white"
                  : "bg-white/15 hover:bg-white/25 text-white"
              }`}
              title="Raise hand"
            >
              <Hand className="h-5 w-5" />
            </button>

            {/* Session notes */}
            <button
              onClick={() => setShowNotes(n => !n)}
              className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
                showNotes
                  ? "bg-blue-500/90 hover:bg-blue-500 text-white"
                  : "bg-white/15 hover:bg-white/25 text-white"
              }`}
              title="Session notes"
            >
              <PenLine className="h-5 w-5" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="h-11 w-11 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 text-white transition-colors"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Tap anywhere to reveal controls when hidden */}
      {controlsHidden && (
        <button
          className="absolute inset-0 z-20 cursor-default"
          onClick={resetHideTimer}
          aria-label="Show controls"
        />
      )}
    </div>
  );
};

export default VideoMeeting;
