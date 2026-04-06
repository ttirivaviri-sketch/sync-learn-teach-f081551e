import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, Clock, Users, Settings, Bell, Calendar, MapPin,
  Star, Video, LogOut, MessageCircle, BarChart3, User, History,
  TrendingUp, Home, Activity, BookOpen, Download
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeBookings, BookingRequest } from "@/hooks/useRealtimeBookings";
import { TutorBookingManager } from "@/components/TutorBookingManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import VideoMeeting from "@/components/VideoMeeting";
import DirectionsMap from "@/components/DirectionsMap";
import ChatInterface from "@/components/ChatInterface";
import StarRating from "@/components/StarRating";
import TutorEarningsChart from "@/components/TutorEarningsChart";
import TutorProfile from "@/components/TutorProfile";
import SessionHistory from "@/components/SessionHistory";
import { useTutorManagement } from '@/hooks/useTutorManagement';
import { TutorSubjectManager } from '@/components/TutorSubjectManager';
import { usePresenceTracking } from '@/hooks/usePresenceTracking';
import { useTutorStats } from '@/hooks/useTutorStats';
import TutorAvailabilitySchedule from '@/components/TutorAvailabilitySchedule';
import { TutorCreatorDashboard } from '@/components/TutorCreatorDashboard';
import { TutorWalletPanel } from '@/components/TutorWalletPanel';
import { StudentInsightsPanel } from '@/components/StudentInsightsPanel';

// ── Type definitions ──────────────────────────────────────────────────────────
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

const TutorApp = () => {
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("home");
  const [isOnline, setIsOnline] = useState(true);
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
  const [videoMeetingData, setVideoMeetingData] = useState<VideoMeetingData | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DirectionsRequest | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatWithUserId, setChatWithUserId] = useState<string | null>(null);
  const [chatWithUserName, setChatWithUserName] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  // Real-time bookings hook
  const {
    bookings,
    loading: bookingsLoading,
    updateBookingStatus,
    getIncomingRequests,
    getUpcomingSessions
  } = useRealtimeBookings('tutor', session?.user?.id);

  // Tutor data management
  const { updateOnlineStatus } = useTutorManagement();

  // Presence tracking for real-time online status
  const { setOnlineStatus, onlineUsers } = usePresenceTracking(session);

  // Real tutor stats from database
  const { formattedStats, weeklyData, recentEarnings, loading: statsLoading } = useTutorStats(session?.user?.id);

  // ── Auth effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setLoading(false);
        if (!newSession?.user) {
          navigate("/tutor/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setLoading(false);
      if (!existingSession?.user) {
        navigate("/tutor/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Load tutor's own subjects with real-time updates
  useEffect(() => {
    if (!session?.user?.id) return;

    const loadSubjects = async () => {
      const { data } = await supabase
        .from('tutor_subjects')
        .select('*')
        .eq('user_id', session.user.id);
      setMySubjects(data || []);
    };
    loadSubjects();

    const channel = supabase
      .channel('my-subjects')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tutor_subjects',
        filter: `user_id=eq.${session.user.id}`,
      }, loadSubjects)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your tutor account.",
      });
      navigate("/tutor/auth");
    } catch {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAcceptRequest = async (booking: BookingRequest) => {
    try {
      await updateBookingStatus(booking.id, 'confirmed');
      toast({
        title: "Request Accepted!",
        description: `Session confirmed with ${booking.learner_profile?.full_name}`,
      });

      // If session is within the next 15 minutes, open video right away
      const sessionTime = new Date(booking.scheduled_at);
      const isNow = Math.abs(sessionTime.getTime() - Date.now()) < 15 * 60 * 1000;
      if (isNow) {
        setVideoMeetingData({
          partnerName: booking.learner_profile?.full_name || "Student",
          subject: booking.tutor_subjects?.subject || "Study Session",
          booking: booking as unknown as Record<string, unknown>,
        });
        setShowVideoMeeting(true);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to accept booking request",
        variant: "destructive",
      });
    }
  };

  const handleJoinVideoSession = (booking: BookingRequest) => {
    setVideoMeetingData({
      partnerName: booking.learner_profile?.full_name || "Student",
      subject: booking.tutor_subjects?.subject || "Study Session",
      booking: booking as unknown as Record<string, unknown>,
    });
    setShowVideoMeeting(true);
  };

  const handleDeclineRequest = async (booking: BookingRequest) => {
    try {
      await updateBookingStatus(booking.id, 'canceled');
      toast({
        title: "Request Declined",
        description: `Declined session with ${booking.learner_profile?.full_name}`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to decline booking request",
        variant: "destructive",
      });
    }
  };

  const handleOnlineToggle = async (checked: boolean) => {
    setIsOnline(checked);
    await Promise.all([
      updateOnlineStatus(checked),
      setOnlineStatus(checked),
    ]);
  };

  const handleRequestPayout = () => {
    toast({
      title: "Payout Requested",
      description: "Your payout request has been submitted and will be processed within 2–3 business days.",
    });
  };

  // ── Early returns ─────────────────────────────────────────────────────────
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

  // Real stats
  const todayStats = {
    earnings: formattedStats.todayEarnings,
    sessions: formattedStats.todaySessions,
    hours: formattedStats.todayHours,
    rating: formattedStats.averageRating || 0,
  };

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 text-white shadow-md"
        style={{ background: "linear-gradient(135deg, #1a3fc4 0%, #2d52e0 50%, #3b63f5 100%)" }}
      >
        <div className="mx-auto flex min-h-[64px] items-center justify-between gap-3 px-4 sm:px-5">
          {/* Logo + tagline */}
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/lovable-uploads/studysync-logo.png"
              alt="StudySync"
              className="h-[52px] w-[150px] shrink-0 object-contain"
              style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))", mixBlendMode: "screen" }}
            />
            <p
              className="hidden sm:block truncate text-[10px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "rgba(255,255,255,0.82)" }}
            >
              Education, in sync with your future
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Online toggle */}
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
              <div className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-400" : "bg-gray-400"}`} />
              <span className="text-xs font-medium text-white">
                {isOnline ? "Online" : "Offline"}
              </span>
              <Switch
                checked={isOnline}
                onCheckedChange={handleOnlineToggle}
                className="scale-75"
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChat(true)}
              className="h-9 w-9 rounded-full p-0 text-white hover:bg-white/15"
              aria-label="Open Chat"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="h-9 w-9 rounded-full p-0 text-white hover:bg-white/15"
              aria-label="Sign Out"
            >
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
              • {onlineUsers.length - 1} other user{onlineUsers.length - 1 !== 1 ? 's' : ''} online
            </span>
          )}
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="p-4 pb-20">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          {/* ── Home Tab ── */}
          <TabsContent value="home" className="space-y-4">
            {/* Today's Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <DollarSign className="h-8 w-8 mx-auto text-primary mb-2" />
                  {statsLoading ? <Skeleton className="h-8 w-20 mx-auto" /> : (
                    <p className="text-2xl font-bold text-primary">{todayStats.earnings}</p>
                  )}
                  <p className="text-sm text-muted-foreground">Today's Earnings</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-8 w-8 mx-auto text-secondary mb-2" />
                  {statsLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (
                    <p className="text-2xl font-bold text-secondary">{todayStats.sessions}</p>
                  )}
                  <p className="text-sm text-muted-foreground">Sessions Today</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <Clock className="h-8 w-8 mx-auto text-accent mb-2" />
                  {statsLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (
                    <p className="text-2xl font-bold text-accent">{todayStats.hours}h</p>
                  )}
                  <p className="text-sm text-muted-foreground">Hours Taught</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <Star className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                  {statsLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (
                    <p className="text-2xl font-bold text-yellow-600">{todayStats.rating}</p>
                  )}
                  <p className="text-sm text-muted-foreground">Rating</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-auto p-4 flex-col"
                  onClick={() => setActiveTab("activity")}
                >
                  <Bell className="h-6 w-6 mb-2" />
                  <span className="text-sm">Update Availability</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto p-4 flex-col"
                  onClick={() => setActiveTab("profile")}
                >
                  <Settings className="h-6 w-6 mb-2" />
                  <span className="text-sm">Profile Settings</span>
                </Button>
              </CardContent>
            </Card>

            {/* Today's Schedule */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {bookingsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : getUpcomingSessions().length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No sessions scheduled for today
                  </p>
                ) : (
                  getUpcomingSessions().slice(0, 3).map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <h4 className="font-medium">{booking.learner_profile?.full_name}</h4>
                        <p className="text-sm text-muted-foreground">{booking.tutor_subjects?.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(booking.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">R{booking.price}</p>
                        <p className="text-xs text-muted-foreground">{booking.duration_minutes} min</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tutorials Tab ── */}
          <TabsContent value="tutorials" className="space-y-4">
            {session?.user?.id ? (
              <TutorCreatorDashboard
                tutorId={session.user.id}
                tutorName={session.user.email?.split('@')[0] || 'Tutor'}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sign in to manage your tutorials.
              </p>
            )}
          </TabsContent>

          {/* ── Activity Tab ── */}
          <TabsContent value="activity" className="space-y-4">
            {/* Booking Manager */}
            <TutorBookingManager
              bookings={bookings}
              loading={bookingsLoading}
              onAccept={handleAcceptRequest}
              onDecline={handleDeclineRequest}
              onJoinSession={handleJoinVideoSession}
              onStartChat={(booking) => {
                setChatWithUserId(booking.learner_id);
                setChatWithUserName(booking.learner_profile?.full_name || "Student");
                setShowChat(true);
              }}
            />

            {/* Availability Schedule — persisted to database via TutorAvailabilitySchedule */}
            <TutorAvailabilitySchedule tutorId={session?.user?.id || ''} />

            {/* Session History */}
            <Card>
              <CardHeader>
                <CardTitle>Session History</CardTitle>
              </CardHeader>
              <CardContent>
                <SessionHistory userType="tutor" userId={session?.user?.id || ""} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Profile Tab ── */}
          <TabsContent value="profile" className="space-y-4">
            {/* Earnings Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "This Week", value: formattedStats.weekEarnings, Icon: TrendingUp, color: "text-primary" },
                { label: "This Month", value: formattedStats.monthEarnings, Icon: DollarSign, color: "text-green-600" },
                { label: "Total Earned", value: formattedStats.totalEarnings, Icon: BarChart3, color: "text-blue-600" },
                { label: "Total Hours", value: `${formattedStats.totalHours}h`, Icon: Clock, color: "text-purple-600" },
              ].map(({ label, value, Icon, color }) => (
                <Card key={label}>
                  <CardContent className="p-4 text-center">
                    {statsLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : (
                      <>
                        <Icon className={`h-8 w-8 mx-auto mb-2 ${color}`} />
                        <p className={`text-2xl font-bold ${color}`}>{value}</p>
                        <p className="text-sm text-muted-foreground">{label}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {weeklyData.length > 0 && <TutorEarningsChart data={weeklyData} />}

            {/* Recent Earnings */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Earnings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : recentEarnings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No completed sessions yet
                  </p>
                ) : (
                  recentEarnings.map((earning) => (
                    <div key={earning.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <h4 className="font-medium">{earning.student}</h4>
                        <p className="text-sm text-muted-foreground">{earning.subject}</p>
                        {earning.rating && (
                          <div className="flex items-center gap-1 mt-1">
                            <StarRating rating={earning.rating} readonly size="sm" />
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">R{earning.amount}</p>
                        <p className="text-xs text-muted-foreground">{earning.date}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Wallet & Payouts */}
            <TutorWalletPanel tutorId={session?.user?.id || ''} />

            {/* Tax Report */}
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => toast({ title: "Tax Report", description: "Feature coming soon!" })}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Tax Report
            </Button>

            {/* Creator shortcut */}
            <Card className="bg-gradient-to-r from-emerald-500/10 to-primary/10 border-emerald-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm">Earn More as a Creator</h4>
                  <p className="text-xs text-muted-foreground">Upload tutorials · reach thousands of students</p>
                </div>
                <Button size="sm" onClick={() => setActiveTab("tutorials")}>
                  <Video className="h-3.5 w-3.5 mr-1" />
                  My Tutorials
                </Button>
              </CardContent>
            </Card>

            <TutorSubjectManager subjects={mySubjects} />

            <TutorProfile user={session?.user} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Chat Interface ── */}
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
