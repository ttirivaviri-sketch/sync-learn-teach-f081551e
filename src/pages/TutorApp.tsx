/**
 * TutorApp — Shell component.
 *
 * Owns: auth, tab state, full-screen overlays (video / directions / chat),
 *       header, bottom nav, and online-status toggle.
 * Delegates each tab's UI to a focused sub-component.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, MessageCircle, Home, BookOpen, Activity, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeBookings, BookingRequest } from "@/hooks/useRealtimeBookings";
import { useTutorManagement } from "@/hooks/useTutorManagement";
import { usePresenceTracking } from "@/hooks/usePresenceTracking";
import { useTutorStats } from "@/hooks/useTutorStats";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import VideoMeeting from "@/components/VideoMeeting";
import DirectionsMap from "@/components/DirectionsMap";
import ChatInterface from "@/components/ChatInterface";
import { TutorCreatorDashboard } from "@/components/TutorCreatorDashboard";

// ── Tab sub-components ──────────────────────────────────────────────────────
import { TutorHomeTab } from "./tutor/TutorHomeTab";
import { TutorActivityTab } from "./tutor/TutorActivityTab";
import { TutorProfileTab } from "./tutor/TutorProfileTab";

// ── Local types ─────────────────────────────────────────────────────────────
interface VideoMeetingData {
  partnerName: string;
  subject: string;
  booking: Record<string, unknown>;
}

interface DirectionsRequest {
  address: string;
  student: string;
  subject: string;
}

// ─────────────────────────────────────────────────────────────────────────────
const TutorApp = () => {
  // ── Shared auth ─────────────────────────────────────────────────────────
  const { session, loading } = useAuth({ redirectTo: "/tutor/auth" });

  // ── UI state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("home");
  const [isOnline, setIsOnline] = useState(true);
  const [mySubjects, setMySubjects] = useState<unknown[]>([]);

  // Full-screen overlays
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
  const [videoMeetingData, setVideoMeetingData] = useState<VideoMeetingData | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DirectionsRequest | null>(null);

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [chatWithUserId, setChatWithUserId] = useState<string | null>(null);
  const [chatWithUserName, setChatWithUserName] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  // ── Data hooks ──────────────────────────────────────────────────────────
  const {
    bookings,
    loading: bookingsLoading,
    updateBookingStatus,
    getUpcomingSessions,
  } = useRealtimeBookings("tutor", session?.user?.id);

  const { updateOnlineStatus } = useTutorManagement();
  const { setOnlineStatus, onlineUsers } = usePresenceTracking(session);
  const { formattedStats, weeklyData, recentEarnings, loading: statsLoading } =
    useTutorStats(session?.user?.id);

  // ── Load tutor's own subjects (real-time) ───────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) return;

    const loadSubjects = async () => {
      const { data } = await supabase
        .from("tutor_subjects")
        .select("*")
        .eq("user_id", session.user.id);
      setMySubjects(data || []);
    };
    loadSubjects();

    const channel = supabase
      .channel("my-subjects")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tutor_subjects",
          filter: `user_id=eq.${session.user.id}`,
        },
        loadSubjects,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({ title: "Signed out successfully", description: "You have been logged out of your tutor account." });
      navigate("/tutor/auth");
    } catch {
      toast({ title: "Error", description: "Failed to sign out. Please try again.", variant: "destructive" });
    }
  };

  const openVideoMeeting = (partnerName: string, subject: string, booking: Record<string, unknown>) => {
    setVideoMeetingData({ partnerName, subject, booking });
    setShowVideoMeeting(true);
  };

  const handleAcceptRequest = async (booking: BookingRequest) => {
    try {
      await updateBookingStatus(booking.id, "confirmed");
      toast({ title: "Request Accepted!", description: `Session confirmed with ${booking.learner_profile?.full_name}` });
      const isNow = Math.abs(new Date(booking.scheduled_at).getTime() - Date.now()) < 15 * 60 * 1000;
      if (isNow) {
        openVideoMeeting(
          booking.learner_profile?.full_name || "Student",
          booking.tutor_subjects?.subject || "Study Session",
          booking as unknown as Record<string, unknown>,
        );
      }
    } catch {
      toast({ title: "Error", description: "Failed to accept booking request", variant: "destructive" });
    }
  };

  const handleDeclineRequest = async (booking: BookingRequest) => {
    try {
      await updateBookingStatus(booking.id, "canceled");
      toast({ title: "Request Declined", description: `Declined session with ${booking.learner_profile?.full_name}` });
    } catch {
      toast({ title: "Error", description: "Failed to decline booking request", variant: "destructive" });
    }
  };

  const handleJoinVideoSession = (booking: BookingRequest) => {
    openVideoMeeting(
      booking.learner_profile?.full_name || "Student",
      booking.tutor_subjects?.subject || "Study Session",
      booking as unknown as Record<string, unknown>,
    );
  };

  const handleOnlineToggle = async (checked: boolean) => {
    setIsOnline(checked);
    await Promise.all([updateOnlineStatus(checked), setOnlineStatus(checked)]);
  };

  // ── Early returns (loading / full-screen overlays) ──────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) return null;

  if (showVideoMeeting && videoMeetingData) {
    return (
      <VideoMeeting
        sessionType="tutor"
        partnerName={videoMeetingData.partnerName}
        subject={videoMeetingData.subject}
        booking={videoMeetingData.booking}
        onEndCall={() => { setShowVideoMeeting(false); setVideoMeetingData(null); }}
      />
    );
  }

  if (showDirections && selectedRequest) {
    return (
      <DirectionsMap
        learnerAddress={selectedRequest.address}
        learnerName={selectedRequest.student}
        subject={selectedRequest.subject}
        onBack={() => { setShowDirections(false); setSelectedRequest(null); }}
      />
    );
  }

  const todayStats = {
    earnings: formattedStats.todayEarnings,
    sessions: formattedStats.todaySessions,
    hours: formattedStats.todayHours,
    rating: formattedStats.averageRating || 0,
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background bg-mesh">
      {/* ── Header ── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 text-white shadow-md"
        style={{ background: "linear-gradient(135deg, #1a3fc4 0%, #2d52e0 50%, #3b63f5 100%)" }}
      >
        <div className="mx-auto flex min-h-[64px] items-center justify-between gap-3 px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/lovable-uploads/studysync-logo.png"
              alt="StudySync"
              className="h-[52px] w-[150px] shrink-0 object-contain"
              style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))", mixBlendMode: "screen" }}
            />
            <p className="hidden sm:block truncate text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.82)" }}>
              Education, in sync with your future
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Online toggle */}
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
              <div className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-400" : "bg-gray-400"}`} />
              <span className="text-xs font-medium text-white">{isOnline ? "Online" : "Offline"}</span>
              <Switch checked={isOnline} onCheckedChange={handleOnlineToggle} className="scale-75" />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowChat(true)} className="h-9 w-9 rounded-full p-0 text-white hover:bg-white/15" aria-label="Open Chat">
              <MessageCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-9 w-9 rounded-full p-0 text-white hover:bg-white/15" aria-label="Sign Out">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Status Banner */}
      <div className="pt-16" />
      {isOnline && (
        <div className="bg-emerald-500 text-white px-5 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          You're online and available for booking requests
          {onlineUsers.length > 1 && (
            <span className="opacity-80 text-xs">
              • {onlineUsers.length - 1} other user{onlineUsers.length - 1 !== 1 ? "s" : ""} online
            </span>
          )}
        </div>
      )}

      {/* ── Main Content (tab panels) ── */}
      <div className="p-4 pb-20">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="home">
            <TutorHomeTab
              todayStats={todayStats}
              statsLoading={statsLoading}
              bookingsLoading={bookingsLoading}
              upcomingSessions={getUpcomingSessions()}
              onNavigateTab={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="tutorials" className="space-y-4">
            {session.user.id ? (
              <TutorCreatorDashboard tutorId={session.user.id} tutorName={session.user.email?.split("@")[0] || "Tutor"} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sign in to manage your tutorials.</p>
            )}
          </TabsContent>

          <TabsContent value="activity">
            <TutorActivityTab
              bookings={bookings}
              bookingsLoading={bookingsLoading}
              tutorId={session.user.id}
              onAccept={handleAcceptRequest}
              onDecline={handleDeclineRequest}
              onJoinSession={handleJoinVideoSession}
              onStartChat={(booking) => {
                setChatWithUserId(booking.learner_id);
                setChatWithUserName(booking.learner_profile?.full_name || "Student");
                setShowChat(true);
              }}
            />
          </TabsContent>

          <TabsContent value="profile">
            <TutorProfileTab
              tutorId={session.user.id}
              user={session.user}
              formattedStats={formattedStats}
              weeklyData={weeklyData}
              recentEarnings={recentEarnings}
              statsLoading={statsLoading}
              mySubjects={mySubjects}
              onNavigateTab={setActiveTab}
              onToast={toast}
            />
          </TabsContent>
        </Tabs>

        {/* ── Bottom Navigation ── */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border/50 shadow-xl z-40">
          <div className="grid grid-cols-4 gap-1 p-2 max-w-lg mx-auto">
            {[
              { id: "home", label: "Home", Icon: Home },
              { id: "tutorials", label: "Tutorials", Icon: BookOpen },
              { id: "activity", label: "Activity", Icon: Activity },
              { id: "profile", label: "Profile", Icon: User },
            ].map(({ id, label, Icon }) => (
              <button key={id} className={`nav-pill ${activeTab === id ? "nav-pill-active" : ""}`} onClick={() => setActiveTab(id)}>
                <Icon className="h-5 w-5" />
                <span className="text-[11px]">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chat Overlay ── */}
      <ChatInterface
        session={session}
        userType="tutor"
        isOpen={showChat}
        onClose={() => { setShowChat(false); setChatWithUserId(null); setChatWithUserName(null); }}
        otherUserId={chatWithUserId || undefined}
        otherUserName={chatWithUserName || undefined}
      />
    </div>
  );
};

export default TutorApp;
