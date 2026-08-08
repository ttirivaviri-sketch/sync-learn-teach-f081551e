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
import { NotificationCenter } from "@/components/NotificationCenter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeBookings, BookingRequest } from "@/hooks/useRealtimeBookings";
import { useHapticsSync } from "@/hooks/useHapticsSync";
import { usePremiumMilestones } from "@/hooks/usePremiumMilestones";
import { useTutorMessageHaptic } from "@/hooks/useTutorMessageHaptic";
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
import TutorOnboardingWizard from "./tutor/TutorOnboardingWizard";
import { TutorPendingScreen } from "./tutor/TutorPendingScreen";
import { useTutorVerificationGate } from "@/hooks/useTutorVerificationGate";
import { useGoogleOAuthProfileSync } from "@/hooks/useGoogleOAuthProfileSync";
import { SuccessSplash } from "@/components/onboarding/SuccessSplash";

import { AppShell } from "@/components/layout/AppShell";

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
  const [showApprovalSplash, setShowApprovalSplash] = useState(false);

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

  const userId = session?.user?.id;

  // Sync Google OAuth sign-ups to the correct role (trigger defaults to learner).
  useGoogleOAuthProfileSync(userId);

  // ── Data hooks ──────────────────────────────────────────────────────────

  const {
    bookings,
    loading: bookingsLoading,
    updateBookingStatus,
    getUpcomingSessions,
  } = useRealtimeBookings("tutor", userId);

  // Cross-device haptics pref, rare premium milestones, and soft message buzz
  useHapticsSync(userId);
  usePremiumMilestones(userId, "tutor");
  useTutorMessageHaptic(userId);

  const { updateOnlineStatus } = useTutorManagement();
  const { setOnlineStatus, onlineUsers } = usePresenceTracking(session);
  const { formattedStats, weeklyData, recentEarnings, loading: statsLoading } =
    useTutorStats(session?.user?.id);
  const gate = useTutorVerificationGate(userId);

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

  // ── Verification gate ───────────────────────────────────────────────────
  // (gate hook called above)
  if (gate.status === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (gate.status === "not_submitted" || gate.status === "incomplete") {
    return <TutorOnboardingWizard />;
  }
  if (gate.status === "pending" || gate.status === "rejected") {
    return <TutorPendingScreen
      status={gate.status}
      submittedAt={gate.submittedAt}
      rejectionReason={gate.rejectionReason}
      onResubmit={() => gate.refetch()}
    />;
  }
  // First time landing as verified → one-time celebration splash
  if (gate.status === "verified") {
    const seenKey = `tutor-approved-seen:${userId}`;
    if (!showApprovalSplash && typeof window !== "undefined" && !localStorage.getItem(seenKey)) {
      setShowApprovalSplash(true);
    }
    if (showApprovalSplash) {
      return <SuccessSplash
        title="You're verified! 🎉"
        subtitle="Welcome aboard. Your tutor account is now live."
        checklist={["Profile is visible to learners", "Booking requests will appear in Activity", "Payments are ready to be received"]}
        ctaLabel="Start teaching"
        onCta={() => { localStorage.setItem(seenKey, "1"); setShowApprovalSplash(false); }}
      />;
    }
  }


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

  // ── Nav items ──────────────────────────────────────────────────────────
  const pendingCount = bookings.filter(b => b.status === "requested").length;
  const navItems = [
    { id: "home",      label: "Home",      icon: <Home     className="h-5 w-5" /> },
    { id: "tutorials", label: "Tutorials", icon: <BookOpen className="h-5 w-5" /> },
    { id: "activity",  label: "Activity",  icon: <Activity className="h-5 w-5" />, badge: pendingCount },
    { id: "profile",   label: "Profile",   icon: <User     className="h-5 w-5" /> },
  ];

  const onlineBanner = isOnline ? (
    <div className="bg-emerald-500 text-white px-5 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
      You're online and available for booking requests
      {onlineUsers.length > 1 && (
        <span className="opacity-80 text-xs">
          • {onlineUsers.length - 1} other user{onlineUsers.length - 1 !== 1 ? "s" : ""} online
        </span>
      )}
    </div>
  ) : undefined;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      navItems={navItems}
      banner={onlineBanner}
      headerLeft={
        <p className="hidden sm:block truncate text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.82)" }}>
          Education, in sync with your future
        </p>
      }
      headerRight={
        <>
          {/* Online toggle */}
          <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
            <div className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-400" : "bg-gray-400"}`} />
            <span className="text-xs font-medium text-white hidden sm:block">{isOnline ? "Online" : "Offline"}</span>
            <Switch checked={isOnline} onCheckedChange={handleOnlineToggle} className="scale-75" />
          </div>
          <NotificationCenter />
          <Button variant="ghost" size="sm" onClick={() => setShowChat(true)} className="h-9 w-9 rounded-full p-0 text-white hover:bg-white/15" aria-label="Open Chat">
            <MessageCircle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-9 w-9 rounded-full p-0 text-white hover:bg-white/15" aria-label="Sign Out">
            <LogOut className="h-5 w-5" />
          </Button>
        </>
      }
    >
      <div className="lg:max-w-screen-xl lg:mx-auto lg:px-6 p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="home">
            <TutorHomeTab
              todayStats={todayStats}
              statsLoading={statsLoading}
              bookingsLoading={bookingsLoading}
              upcomingSessions={getUpcomingSessions()}
              pendingCount={pendingCount}
              tutorName={session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "Tutor"}
              mySubjects={mySubjects as any}
              tutorId={userId}
              onNavigateTab={setActiveTab}
              onJoinSession={handleJoinVideoSession}
            />
          </TabsContent>

          <TabsContent value="tutorials" className="space-y-4">
            {userId ? (
              <TutorCreatorDashboard tutorId={userId} tutorName={session?.user?.email?.split("@")[0] || "Tutor"} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sign in to manage your tutorials.</p>
            )}
          </TabsContent>

          <TabsContent value="activity">
            <TutorActivityTab
              bookings={bookings}
              bookingsLoading={bookingsLoading}
              tutorId={userId || ""}
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
              tutorId={userId || ""}
              user={session?.user as any}
              formattedStats={formattedStats}
              weeklyData={weeklyData as any}
              recentEarnings={recentEarnings}
              statsLoading={statsLoading}
              mySubjects={mySubjects as any}
              onNavigateTab={setActiveTab}
              onToast={toast}
            />
          </TabsContent>
        </Tabs>
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
    </AppShell>
  );
};

export default TutorApp;
