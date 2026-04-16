import { useState, useEffect, useRef } from "react";
import { Video, X, PenLine, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

// Sub-components
import { PreCallScreen } from "@/components/video-meeting/PreCallScreen";
import { ConnectingScreen } from "@/components/video-meeting/ConnectingScreen";
import { MeetingSummaryScreen } from "@/components/video-meeting/MeetingSummaryScreen";
import { MeetingTopBar } from "@/components/video-meeting/MeetingTopBar";
import { MeetingControlBar } from "@/components/video-meeting/MeetingControlBar";

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

  const [screen, setScreen] = useState<Screen>("precall");
  const [camOk, setCamOk] = useState<boolean | null>(null);
  const [micOk, setMicOk] = useState<boolean | null>(null);
  const [netOk, setNetOk] = useState<boolean | null>(null);
  const [checksDone, setChecksDone] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const scheduledDuration = booking?.duration_minutes || 60;
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
  const [rating, setRating] = useState(0);
  const [summaryNotes, setSummaryNotes] = useState("");
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer
  useEffect(() => {
    if (screen !== "meeting" || !sessionStartTime) return;
    const timer = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - sessionStartTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [screen, sessionStartTime]);

  // Pre-call device checks
  useEffect(() => {
    if (screen !== "precall") return;
    runChecks();
  }, [screen]);

  const runChecks = async () => {
    setCamOk(null); setMicOk(null); setNetOk(null); setChecksDone(false);
    const online = navigator.onLine;
    setTimeout(() => setNetOk(online), 400);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setTimeout(() => setCamOk(true), 700);
      setTimeout(() => setMicOk(true), 1000);
    } catch (e: any) {
      const isCam = e.name !== "NotFoundError";
      setTimeout(() => setCamOk(!isCam ? false : true), 700);
      setTimeout(() => setMicOk(false), 1000);
    }
    setTimeout(() => setChecksDone(true), 1400);
  };

  // Jitsi init
  const initSession = async () => {
    setScreen("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e: any) {
      let msg = "Camera and microphone access denied.";
      if (e.name === "NotFoundError") msg = "No camera or microphone detected.";
      if (e.name === "NotReadableError") msg = "Camera/mic already in use by another app.";
      setPermissionError(msg);
      setScreen("meeting");
      setIsLoading(false);
      return;
    }

    if (window.JitsiMeetExternalAPI) {
      initJitsi();
    } else {
      const script = document.createElement("script");
      script.src = "https://8x8.vc/external_api.js";
      script.async = true;
      script.onload = () => initJitsi();
      script.onerror = () => {
        setIsLoading(false);
        setScreen("meeting");
        toast({ title: "Connection Failed", description: "Unable to load video service.", variant: "destructive" });
      };
      document.body.appendChild(script);
    }
  };

  const initJitsi = () => {
    if (!jitsiContainer.current || jitsiApi.current) return;
    const roomName = `StudySync-${booking?.id || "demo-session"}`;
    console.log("[VideoMeeting] Joining room:", roomName);
    const displayName = sessionType === "tutor" ? "Tutor" : "Learner";

    try {
      jitsiApi.current = new window.JitsiMeetExternalAPI("8x8.vc", {
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
          p2p: { enabled: true, stunServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] },
          resolution: 720,
          constraints: { video: { height: { ideal: 720, max: 1080, min: 360 }, width: { ideal: 1280, max: 1920, min: 640 } } },
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup'],
          DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
        },
        userInfo: { displayName },
      });

      jitsiApi.current.addEventListener("videoConferenceJoined", () => {
        setIsLoading(false); setScreen("meeting"); setSessionStartTime(new Date());
        toast({ title: "Connected ✓", description: `Joined room: ${roomName}` });
      });
      jitsiApi.current.addEventListener("participantJoined", (p: any) => {
        setParticipantCount((c) => c + 1);
        toast({ title: "Joined", description: `${p.displayName || "Someone"} joined the session.` });
      });
      jitsiApi.current.addEventListener("participantLeft", (p: any) => {
        setParticipantCount((c) => Math.max(1, c - 1));
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

      setTimeout(() => {
        if (isLoading) { setIsLoading(false); setScreen("meeting"); }
      }, 30000);
    } catch {
      setIsLoading(false);
      setScreen("meeting");
      toast({ title: "Initialization Failed", description: "Failed to start video. Please refresh.", variant: "destructive" });
    }
  };

  // Controls
  const handleEndCall = () => {
    if (jitsiApi.current) { jitsiApi.current.dispose(); jitsiApi.current = null; }
    setSummaryNotes(notes);
    setScreen("summary");
  };

  const toggleAudio = () => jitsiApi.current?.executeCommand("toggleAudio");
  const toggleVideo = () => jitsiApi.current?.executeCommand("toggleVideo");
  const toggleScreenShare = () => jitsiApi.current?.executeCommand("toggleShareScreen");
  const toggleHandRaise = () => { jitsiApi.current?.executeCommand("toggleRaiseHand"); setIsHandRaised((r) => !r); };
  const toggleFullscreen = () => {
    if (!isFullscreen) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
    setIsFullscreen((f) => !f);
  };

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

  // Persistent Jitsi container class — visible during connecting & meeting, hidden otherwise
  const jitsiContainerClass =
    screen === "meeting" || screen === "connecting"
      ? "fixed inset-0 z-0 w-full h-full"
      : "fixed top-0 left-0 w-0 h-0 overflow-hidden";

  return (
    <>
      {/* Persistent Jitsi container — always in DOM, never unmounted */}
      <div className={jitsiContainerClass}>
        <div ref={jitsiContainer} className="w-full h-full" />
      </div>

      {/* Screen overlays */}
      {screen === "precall" && (
        <PreCallScreen
          subject={subject}
          partnerName={partnerName}
          scheduledAt={booking?.scheduled_at}
          scheduledDuration={scheduledDuration}
          camOk={camOk}
          micOk={micOk}
          netOk={netOk}
          checksDone={checksDone}
          onJoin={initSession}
          onRecheck={runChecks}
          onCancel={onEndCall}
        />
      )}

      {screen === "connecting" && (
        <div className="fixed inset-0 z-10">
          <ConnectingScreen partnerName={partnerName} />
        </div>
      )}

      {screen === "summary" && (
        <MeetingSummaryScreen
          subject={subject}
          partnerName={partnerName}
          sessionDuration={sessionDuration}
          rating={rating}
          summaryNotes={summaryNotes}
          onRate={setRating}
          onDone={onEndCall}
        />
      )}

      {screen === "meeting" && (
        <div
          className="fixed inset-0 z-10 flex flex-col pointer-events-none"
          onPointerMove={resetHideTimer}
          onPointerDown={resetHideTimer}
          style={{ pointerEvents: "auto" }}
        >
          <MeetingTopBar
            subject={subject}
            partnerName={partnerName}
            connectionQuality={connectionQuality}
            participantCount={participantCount}
            sessionDuration={sessionDuration}
            scheduledDuration={scheduledDuration}
            hidden={controlsHidden}
          />

          {/* Permission Error */}
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

          {/* Waiting banner */}
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

          {/* Loading overlay */}
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

          {/* Spacer to push controls to bottom */}
          <div className="flex-1" />

          {/* Session Notes panel */}
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
                onChange={(e) => setNotes(e.target.value)}
              />
              <p className="text-white/30 text-xs text-center pb-3">Notes are saved locally and shown after the call</p>
            </div>
          )}

          <MeetingControlBar
            isAudioMuted={isAudioMuted}
            isVideoMuted={isVideoMuted}
            isScreenSharing={isScreenSharing}
            isHandRaised={isHandRaised}
            isFullscreen={isFullscreen}
            showNotes={showNotes}
            hidden={controlsHidden}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onToggleScreenShare={toggleScreenShare}
            onToggleHandRaise={toggleHandRaise}
            onToggleFullscreen={toggleFullscreen}
            onToggleNotes={() => setShowNotes((n) => !n)}
            onEndCall={handleEndCall}
          />

          {/* Tap anywhere to reveal controls when hidden */}
          {controlsHidden && (
            <button className="absolute inset-0 z-20 cursor-default" onClick={resetHideTimer} aria-label="Show controls" />
          )}
        </div>
      )}
    </>
  );
};

export default VideoMeeting;
