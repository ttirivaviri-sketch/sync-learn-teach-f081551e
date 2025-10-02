import { useState, useEffect, useRef } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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

const VideoMeeting = ({ sessionType, partnerName, subject, booking, onEndCall }: VideoMeetingProps) => {
  const { toast } = useToast();
  const jitsiContainer = useRef<HTMLDivElement>(null);
  const jitsiApi = useRef<any>(null);
  const [sessionStartTime] = useState(new Date());
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Update session timer
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const duration = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
      setSessionDuration(duration);
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionStartTime]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize Jitsi Meet
  useEffect(() => {
    const loadJitsi = () => {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = () => initJitsi();
      document.body.appendChild(script);
    };

    const initJitsi = () => {
      if (!jitsiContainer.current || jitsiApi.current) return;

      const roomName = `StudySync-${booking?.id || 'demo'}-${Date.now()}`;
      const displayName = sessionType === "tutor" ? "Tutor" : "Learner";

      const options = {
        roomName,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainer.current,
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone',
            'camera',
            'closedcaptions',
            'desktop',
            'fullscreen',
            'fodeviceselection',
            'hangup',
            'chat',
            'recording',
            'livestreaming',
            'etherpad',
            'sharedvideo',
            'settings',
            'raisehand',
            'videoquality',
            'filmstrip',
            'stats',
            'shortcuts',
            'tileview',
            'download',
            'help',
            'mute-everyone',
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
        },
        userInfo: {
          displayName,
        },
      };

      jitsiApi.current = new window.JitsiMeetExternalAPI('meet.jit.si', options);

      jitsiApi.current.addEventListener('videoConferenceJoined', () => {
        setIsLoading(false);
        toast({
          title: "Connected",
          description: "You've joined the video session",
        });
      });

      jitsiApi.current.addEventListener('readyToClose', () => {
        handleEndCall();
      });
    };

    if (!window.JitsiMeetExternalAPI) {
      loadJitsi();
    } else {
      initJitsi();
    }

    return () => {
      if (jitsiApi.current) {
        jitsiApi.current.dispose();
        jitsiApi.current = null;
      }
    };
  }, [booking?.id, sessionType, toast]);

  const handleEndCall = () => {
    if (jitsiApi.current) {
      jitsiApi.current.dispose();
      jitsiApi.current = null;
    }
    onEndCall();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{subject} Session</h2>
          <p className="text-sm opacity-90">with {partnerName}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-background text-foreground">
            {formatDuration(sessionDuration)}
          </Badge>
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            Online Lesson
          </Badge>
        </div>
      </header>

      {/* Jitsi Meet Container */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Connecting to video session...</p>
            </div>
          </div>
        )}
        <div ref={jitsiContainer} className="w-full h-full" />
      </div>

      {/* End Call Button */}
      <div className="p-4 bg-card border-t flex justify-center">
        <Button
          variant="destructive"
          size="lg"
          className="rounded-full px-8"
          onClick={handleEndCall}
        >
          <Phone className="h-5 w-5 mr-2" />
          End Call
        </Button>
      </div>
    </div>
  );
};

export default VideoMeeting;