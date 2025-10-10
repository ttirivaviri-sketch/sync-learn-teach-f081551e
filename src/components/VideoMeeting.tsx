import { useState, useEffect, useRef } from "react";
import { Phone, Mic, MicOff, Video, VideoOff, Users, Signal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(1);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'unknown'>('unknown');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

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

  // Request media permissions first
  const requestMediaPermissions = async () => {
    console.log('🎤 Requesting camera and microphone permissions...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      console.log('✅ Media permissions granted');
      // Stop the test stream - Jitsi will request its own
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error: any) {
      console.error('❌ Media permission denied:', error);
      
      let errorMessage = 'Camera and microphone access denied. Please allow access to continue.';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera/microphone access denied. Please check your browser permissions.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found. Please connect a device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera/microphone is already in use by another application.';
      }
      
      setPermissionError(errorMessage);
      setIsLoading(false);
      toast({
        title: "Permission Required",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    }
  };

  // Initialize Jitsi Meet
  useEffect(() => {
    console.log('🎥 VideoMeeting: Initializing video session', {
      sessionType,
      partnerName,
      subject,
      bookingId: booking?.id
    });

    const loadJitsi = () => {
      console.log('📥 Loading Jitsi Meet script...');
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = async () => {
        console.log('✅ Jitsi Meet script loaded successfully');
        // Request permissions before initializing Jitsi
        const hasPermissions = await requestMediaPermissions();
        if (hasPermissions) {
          initJitsi();
        }
      };
      script.onerror = (error) => {
        console.error('❌ Failed to load Jitsi Meet script:', error);
        setIsLoading(false);
        toast({
          title: "Connection Failed",
          description: "Unable to load video service. Please check your internet connection.",
          variant: "destructive",
        });
      };
      document.body.appendChild(script);
    };

    const initJitsi = () => {
      if (!jitsiContainer.current) {
        console.error('❌ Jitsi container not found');
        return;
      }
      
      if (jitsiApi.current) {
        console.log('⚠️ Jitsi API already initialized');
        return;
      }

      // Use room_name from booking if available, otherwise fallback to booking ID
      const roomName = booking?.room_name || `StudySync-${booking?.id || 'demo-session'}`;
      const displayName = sessionType === "tutor" ? "Tutor" : "Learner";

      if (!booking?.room_name && !booking?.id) {
        console.warn('⚠️ No booking room_name or ID found - using demo room');
      }

      console.log('🚀 Initializing Jitsi Meet with:', { 
        roomName, 
        displayName, 
        bookingId: booking?.id,
        roomNameSource: booking?.room_name ? 'database' : 'fallback'
      });

      try {
        const options = {
          roomName,
          width: '100%',
          height: '100%',
          parentNode: jitsiContainer.current,
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            enableWelcomePage: false,
            prejoinPageEnabled: false, // Disable prejoin for direct connection
            disableDeepLinking: true,
            enableNoisyMicDetection: true,
            enableNoAudioDetection: true,
            enableClosePage: false,
            // WebRTC configuration for better connectivity
            p2p: {
              enabled: true,
              stunServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
              ]
            },
            // Better audio/video quality
            resolution: 720,
            constraints: {
              video: {
                height: { ideal: 720, max: 1080, min: 360 },
                width: { ideal: 1280, max: 1920, min: 640 }
              }
            }
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
              'fodeviceselection', 'hangup', 'chat', 'recording',
              'settings', 'raisehand', 'videoquality', 'filmstrip',
              'stats', 'shortcuts', 'tileview', 'download', 'help'
            ],
          },
          userInfo: {
            displayName,
          },
        };

        jitsiApi.current = new window.JitsiMeetExternalAPI('meet.jit.si', options);
        console.log('✅ Jitsi API instance created');

        // Event: Successfully joined
        jitsiApi.current.addEventListener('videoConferenceJoined', (event: any) => {
          console.log('🎉 Successfully joined video conference', event);
          setIsLoading(false);
          toast({
            title: "Connected",
            description: "You've joined the video session",
          });
        });

        // Event: Participant joined
        jitsiApi.current.addEventListener('participantJoined', (participant: any) => {
          console.log('👤 Participant joined:', participant);
          setParticipantCount(prev => prev + 1);
          toast({
            title: "Participant Joined",
            description: `${participant.displayName || 'Someone'} has joined the session`,
          });
        });

        // Event: Participant left
        jitsiApi.current.addEventListener('participantLeft', (participant: any) => {
          console.log('👋 Participant left:', participant);
          setParticipantCount(prev => Math.max(1, prev - 1));
          toast({
            title: "Participant Left",
            description: `${participant.displayName || 'Someone'} has left the session`,
          });
        });

        // Event: Audio mute status changed
        jitsiApi.current.addEventListener('audioMuteStatusChanged', (event: any) => {
          console.log('🎤 Audio mute status:', event);
          setIsAudioMuted(event.muted);
        });

        // Event: Video mute status changed
        jitsiApi.current.addEventListener('videoMuteStatusChanged', (event: any) => {
          console.log('📹 Video mute status:', event);
          setIsVideoMuted(event.muted);
        });

        // Event: Connection quality changed
        jitsiApi.current.addEventListener('participantConnectionStatusChanged', (event: any) => {
          console.log('📶 Connection status:', event);
          if (event.connectionQuality === 'good' || event.connectionQuality > 50) {
            setConnectionQuality('good');
          } else {
            setConnectionQuality('poor');
          }
        });

        // Event: Left conference
        jitsiApi.current.addEventListener('videoConferenceLeft', () => {
          console.log('👋 Left video conference');
        });

        // Event: Ready to close
        jitsiApi.current.addEventListener('readyToClose', () => {
          console.log('🔚 Video conference ready to close');
          handleEndCall();
        });

        // Event: Error occurred
        jitsiApi.current.addEventListener('errorOccurred', (error: any) => {
          console.error('❌ Jitsi error occurred:', error);
          toast({
            title: "Connection Error",
            description: error.message || "An error occurred during the video session",
            variant: "destructive",
          });
        });

        // Event: Camera error
        jitsiApi.current.addEventListener('cameraError', (error: any) => {
          console.error('📹 Camera error:', error);
          toast({
            title: "Camera Error",
            description: "There was an issue with your camera. Check permissions and try again.",
            variant: "destructive",
          });
        });

        // Event: Mic error
        jitsiApi.current.addEventListener('micError', (error: any) => {
          console.error('🎤 Microphone error:', error);
          toast({
            title: "Microphone Error",
            description: "There was an issue with your microphone. Check permissions and try again.",
            variant: "destructive",
          });
        });

        // Set timeout to detect connection issues
        const connectionTimeout = setTimeout(() => {
          if (isLoading) {
            console.error('⏱️ Connection timeout - taking too long to connect');
            setIsLoading(false);
            toast({
              title: "Connection Timeout",
              description: "Taking longer than expected to connect. Please check your internet connection and firewall settings.",
              variant: "destructive",
            });
          }
        }, 30000); // 30 seconds

        return () => clearTimeout(connectionTimeout);
      } catch (error) {
        console.error('❌ Failed to initialize Jitsi:', error);
        setIsLoading(false);
        toast({
          title: "Initialization Failed",
          description: "Failed to start video session. Please refresh and try again.",
          variant: "destructive",
        });
      }
    };

    if (!window.JitsiMeetExternalAPI) {
      loadJitsi();
    } else {
      console.log('ℹ️ Jitsi Meet API already available');
      requestMediaPermissions().then(hasPermissions => {
        if (hasPermissions) {
          initJitsi();
        }
      });
    }

    return () => {
      console.log('🧹 Cleaning up video session');
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

  const toggleAudio = () => {
    if (jitsiApi.current) {
      jitsiApi.current.executeCommand('toggleAudio');
    }
  };

  const toggleVideo = () => {
    if (jitsiApi.current) {
      jitsiApi.current.executeCommand('toggleVideo');
    }
  };

  const getConnectionQualityColor = () => {
    switch (connectionQuality) {
      case 'good': return 'text-green-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-3 sm:p-4 flex items-center justify-between shrink-0 z-30">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">{subject} Session</h2>
          <p className="text-xs sm:text-sm opacity-90">with {partnerName}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Badge variant="outline" className="bg-background text-foreground flex items-center gap-1 text-xs">
            <Users className="h-3 w-3" />
            {participantCount}
          </Badge>
          <Badge variant="outline" className="bg-background text-foreground flex items-center gap-1 text-xs">
            <Signal className={`h-3 w-3 ${getConnectionQualityColor()}`} />
            {connectionQuality === 'unknown' ? 'Connecting...' : connectionQuality === 'good' ? 'Good' : 'Poor'}
          </Badge>
          <Badge variant="outline" className="bg-background text-foreground text-xs">
            {formatDuration(sessionDuration)}
          </Badge>
          <Badge variant="secondary" className="bg-green-100 text-green-700 hidden sm:inline-flex text-xs">
            Online Lesson
          </Badge>
        </div>
      </header>

      {/* Permission Error Alert */}
      {permissionError && (
        <Alert variant="destructive" className="m-4 shrink-0">
          <AlertDescription>
            {permissionError}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Waiting for Participant */}
      {!isLoading && participantCount === 1 && !permissionError && (
        <div className="absolute top-20 sm:top-24 left-1/2 transform -translate-x-1/2 z-20 max-w-sm mx-4">
          <Alert className="bg-card border-primary">
            <Users className="h-4 w-4" />
            <AlertDescription>
              Waiting for {sessionType === "tutor" ? "the learner" : "your tutor"} to join...
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Jitsi Meet Container - Fullscreen */}
      <div className="flex-1 relative w-full overflow-hidden">
        {isLoading && !permissionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground font-medium">Connecting to video session...</p>
              <p className="text-sm text-muted-foreground mt-2">Please allow camera and microphone access</p>
            </div>
          </div>
        )}
        <div ref={jitsiContainer} className="w-full h-full" />
      </div>

      {/* Control Bar */}
      <div className="p-3 sm:p-4 bg-card border-t flex justify-center gap-3 sm:gap-4 shrink-0">
        <Button
          variant={isAudioMuted ? "destructive" : "secondary"}
          size="lg"
          className="rounded-full h-12 w-12 sm:h-14 sm:w-14"
          onClick={toggleAudio}
        >
          {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button
          variant={isVideoMuted ? "destructive" : "secondary"}
          size="lg"
          className="rounded-full h-12 w-12 sm:h-14 sm:w-14"
          onClick={toggleVideo}
        >
          {isVideoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </Button>
        <Button
          variant="destructive"
          size="lg"
          className="rounded-full px-6 sm:px-8 h-12 sm:h-14"
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