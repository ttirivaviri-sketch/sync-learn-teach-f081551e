import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Home, BookOpen, Activity, MapPin, Star, Clock, CreditCard, User, Video, ShoppingBag, LogOut, MessageCircle, Search, Award, Zap, GraduationCap } from "lucide-react";
import { useDevMode } from "@/contexts/DevModeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VideoMeeting from "@/components/VideoMeeting";
import StudySyncLibrary from "@/components/StudySyncLibrary";
import LaunchScreen from "@/components/LaunchScreen";
import ChatInterface from "@/components/ChatInterface";
import ReviewModal from "@/components/ReviewModal";
import StarRating from "@/components/StarRating";
import { AdvancedBooking } from "@/components/AdvancedBooking";
import { LoadingScreen } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { analytics } from "@/utils/analytics";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { LiveBookingCard } from "@/components/LiveBookingCard";
import { QuickBookingModal } from "@/components/QuickBookingModal";
import { PaymentHistory } from "@/components/PaymentHistory";
import { useTutorData, TutorProfile } from '@/hooks/useTutorData';
import { usePresenceTracking } from '@/hooks/usePresenceTracking';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useBookingPayments } from '@/hooks/useBookingPayments';
import { PendingPaymentCard } from '@/components/PendingPaymentCard';
import { PaymentCheckout } from '@/components/PaymentCheckout';
import LearnerSyllabusManager from '@/components/LearnerSyllabusManager';
import { useLearnerSubjects } from '@/hooks/useLearnerSubjects';
import { ProfilePhotoUpload } from '@/components/ProfilePhotoUpload';
import { RescheduleDialog } from '@/components/RescheduleDialog';
import { AcademicProfileSetup } from '@/components/AcademicProfileSetup';
import { useAcademicProfile } from '@/hooks/useAcademicProfile';

// ── Type definitions ──────────────────────────────────────────────────────────
interface UserProfile {
  id: string;
  full_name?: string;
  email?: string;
  user_type?: string;
  study_level?: string;
  avatar_url?: string;
}

interface VideoMeetingData {
  partnerName: string;
  subject: string;
  booking: Record<string, unknown>;
}

// ── Skeleton card for loading state ──────────────────────────────────────────
const TutorCardSkeleton = () => (
  <Card className="shadow-sm">
    <CardContent className="p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-24" />
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

const LearnerApp = () => {
  const { isDevMode, devRole, devUserName, bypassPayments, bypassSchedule, devSessionActive, setDevSessionActive, launchDevSession } = useDevMode();
  const [activeTab, setActiveTab] = useState("home");
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
  const [videoMeetingData, setVideoMeetingData] = useState<VideoMeetingData | null>(null);
  const [showLaunchScreen, setShowLaunchScreen] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAcademicSetup, setShowAcademicSetup] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [userLocationName] = useState("Johannesburg Central");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bookingRequests, setBookingRequests] = useState<unknown[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatWithUserId, setChatWithUserId] = useState<string | null>(null);
  const [chatWithUserName, setChatWithUserName] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState<{
    bookingId: string;
    reviewedId: string;
    reviewedName: string;
    userType: 'learner' | 'tutor';
  } | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState<{
    id: string;
    name: string;
    subject: string;
    level: string;
    price: number;
    subjectId: string;
    avatar?: string;
  } | null>(null);
  const [showPaymentForBooking, setShowPaymentForBooking] = useState<any>(null);
  const [checkoutBooking, setCheckoutBooking] = useState<any>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState<any>(null);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { isOnline, isSlowConnection } = useNetworkStatus();

  // Real-time bookings hook
  const {
    bookings,
    loading: bookingsLoading,
    createBooking,
    updateBookingStatus,
    getUpcomingSessions
  } = useRealtimeBookings('learner', session?.user?.id);

  // Geolocation, tutor data and presence tracking
  const { location: userGeoLocation, getCurrentLocation, loading: locationLoading } = useGeolocation();
  const { tutors, allSubjects, loading: tutorsLoading, refreshTutors } = useTutorData(userGeoLocation, {
    subjectFilter: selectedSubject,
    searchQuery: searchQuery,
    studyLevel: profile?.study_level || undefined,
  });
  const { isUserOnline } = usePresenceTracking(session);

  // Academic Profile (drives library personalisation)
  const {
    profile: academicProfile,
    loading: academicProfileLoading,
    saving: academicProfileSaving,
    saveProfile: saveAcademicProfile,
  } = useAcademicProfile(session?.user?.id || (isDevMode ? 'dev-user' : undefined));

  // Get confirmed bookings that need payment
  const confirmedBookingIds = useMemo(
    () => bookings.filter(b => b.status === 'confirmed').map(b => b.id),
    [bookings]
  );
  const { needsPayment } = useBookingPayments(confirmedBookingIds);

  // Bookings that need payment (confirmed but not paid)
  const bookingsNeedingPayment = useMemo(
    () => bookings.filter(b => b.status === 'confirmed' && needsPayment(b.id)),
    [bookings, needsPayment]
  );

  // ── Dev mode: respond to launchDevSession trigger ────────────────────────
  useEffect(() => {
    if (isDevMode && devRole === 'learner' && devSessionActive) {
      setVideoMeetingData({
        partnerName: 'Dev Tutor',
        subject: 'Dev Test Session',
        booking: {
          id: 'dev-booking-001',
          room_name: 'StudySync-Dev-Test-Room',
          duration_minutes: 60,
          scheduled_at: new Date().toISOString(),
          tutor_profile: { full_name: 'Dev Tutor' },
          tutor_subjects: { subject: 'Dev Test Session' },
        },
      });
      setShowVideoMeeting(true);
      setDevSessionActive(false);
    }
  }, [devSessionActive, isDevMode, devRole, setDevSessionActive]);

  // ── Auth effect (no `loading` in deps to avoid infinite re-render) ────────
  useEffect(() => {
    analytics.pageView('learner-app');

    // Dev mode: skip auth entirely
    if (isDevMode && devRole === 'learner') {
      setLoading(false);
      setShowLaunchScreen(false);
      setProfile({ id: 'dev-user', full_name: devUserName, user_type: 'learner', study_level: 'senior_high' });
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setLoading(false);
        if (!newSession?.user) {
          navigate("/learner/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setLoading(false);
      if (!existingSession?.user) {
        navigate("/learner/auth");
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, isDevMode, devRole]);

  // Load user profile and upcoming sessions
  useEffect(() => {
    if (session?.user) {
      loadUserProfile();
      getCurrentLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Show academic profile setup prompt if profile is missing
  useEffect(() => {
    if (!academicProfileLoading && !academicProfile && (session?.user || isDevMode)) {
      const timer = setTimeout(() => setShowAcademicSetup(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [academicProfileLoading, academicProfile, session?.user, isDevMode]);

  // Listen for custom toast events from StudySyncLibrary
  useEffect(() => {
    const handleToastEvent = (event: CustomEvent<{ title: string; description: string }>) => {
      toast({ title: event.detail.title, description: event.detail.description });
    };
    window.addEventListener('show-toast', handleToastEvent as EventListener);
    return () => window.removeEventListener('show-toast', handleToastEvent as EventListener);
  }, [toast]);

  // Track tab changes
  useEffect(() => {
    analytics.track('tab_changed', { tab: activeTab });
  }, [activeTab]);

  const loadUserProfile = async () => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
        return;
      }

      setProfile(data);
      if (!data?.study_level) {
        toast({
          title: "Select your study level",
          description: "Choose your level to personalize your search.",
        });
        navigate('/learner/choose-level');
      }
    } catch (error) {
      console.error('Profile load error:', error);
    }
  };

  const handleSignOut = () => setShowSignOutConfirm(true);

  const confirmSignOut = async () => {
    try {
      analytics.track('user_signout', { userType: 'learner' });
      await supabase.auth.signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your learner account.",
      });
      navigate("/learner/auth");
    } catch (error) {
      analytics.error(error as Error, 'sign_out_failed');
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowSignOutConfirm(false);
    }
  };

  // ── Unified booking handler (replaces handleBookInPerson & handleBookOnline) ──
  const handleBookTutor = (tutor: TutorProfile) => {
    if (!isOnline) {
      toast({
        title: "No connection",
        description: "Please check your internet connection to book sessions.",
        variant: "destructive",
      });
      return;
    }
    if (!session?.user && !isDevMode) {
      toast({
        title: "Authentication required",
        description: "Please sign in to book sessions.",
        variant: "destructive",
      });
      navigate("/learner/auth");
      return;
    }
    if (!tutor.subjects || tutor.subjects.length === 0) {
      toast({
        title: "No subjects available",
        description: "This tutor hasn't set up their subjects yet.",
        variant: "destructive",
      });
      return;
    }

    analytics.track('booking_initiated', { tutorId: tutor.id });

    const firstSubject = tutor.subjects[0];
    setSelectedTutor({
      id: tutor.id,
      name: tutor.full_name || 'Tutor',
      subject: firstSubject.subject,
      level: firstSubject.level,
      price: firstSubject.hourly_rate,
      subjectId: firstSubject.id,
      avatar: tutor.avatar_url,
    });
    setShowBookingModal(true);
  };

  const handleSessionAction = (action: string) => {
    if (action === "join") {
      const upcomingSessions = getUpcomingSessions();
      const nextSession = upcomingSessions.length > 0 ? upcomingSessions[0] : null;

      if (!nextSession) {
        toast({
          title: "No Session Found",
          description: "Unable to find an upcoming session to join.",
          variant: "destructive",
        });
        return;
      }

      setVideoMeetingData({
        partnerName: (nextSession.tutor_profile as { full_name?: string })?.full_name || "Tutor",
        subject: (nextSession.tutor_subjects as { subject?: string })?.subject || "Study Session",
        booking: nextSession as unknown as Record<string, unknown>,
      });
      setShowVideoMeeting(true);
      return;
    }

    if (action === "reschedule") {
      const upcoming = getUpcomingSessions();
      if (upcoming.length > 0) {
        setRescheduleBooking(upcoming[0]);
        setShowReschedule(true);
      } else {
        toast({ title: "No upcoming sessions", description: "Nothing to reschedule right now." });
      }
      return;
    }

    toast({
      title: "Cancel Session",
      description: "Session cancellation processed",
      variant: "destructive"
    });
  };

  const handleJoinVideoSession = (booking: unknown) => {
    const b = booking as { id?: string; tutor_profile?: { full_name?: string }; tutor_subjects?: { subject?: string } };
    if (!b?.id) {
      toast({
        title: "Invalid Session",
        description: "Unable to join session. Missing booking information.",
        variant: "destructive",
      });
      return;
    }

    setVideoMeetingData({
      partnerName: b.tutor_profile?.full_name || "Tutor",
      subject: b.tutor_subjects?.subject || "Study Session",
      booking: booking as Record<string, unknown>,
    });
    setShowVideoMeeting(true);
  };

  const handlePayNow = (booking: unknown) => {
    if (bypassPayments) {
      toast({ title: "Dev Mode", description: "Payment bypassed — booking marked as paid." });
      return;
    }
    setCheckoutBooking(booking);
  };

  const handleStartCheckout = (booking: any) => {
    if (bypassPayments) {
      toast({ title: "Dev Mode", description: "Payment bypassed — booking marked as paid." });
      return;
    }
    setCheckoutBooking(booking);
  };

  const handleStartChat = (tutor: { id: string | number; full_name?: string; name?: string }) => {
    setChatWithUserId(tutor.id.toString());
    setChatWithUserName(tutor.full_name || tutor.name || 'Tutor');
    setShowChat(true);
  };

  // ── Early returns ─────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen message="Loading your account..." />;
  if (!isDevMode && !session?.user) return null;
  if (showLaunchScreen && !isDevMode) return <LaunchScreen onComplete={() => setShowLaunchScreen(false)} />;

  // Full-screen payment checkout
  if (checkoutBooking) {
    return (
      <PaymentCheckout
        booking={checkoutBooking}
        onBack={() => setCheckoutBooking(null)}
        onPaymentInitiated={() => {
          // Payment form submitted - user will be redirected to PayFast
          // On return, PaymentSuccess/PaymentCancelled pages handle the rest
        }}
      />
    );
  }

  if (showVideoMeeting && videoMeetingData) {
    return (
      <VideoMeeting
        sessionType="learner"
        partnerName={videoMeetingData.partnerName}
        subject={videoMeetingData.subject}
        booking={videoMeetingData.booking}
        onEndCall={() => {
          setShowVideoMeeting(false);
          setVideoMeetingData(null);
        }}
      />
    );
  }

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

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <NotificationCenter />
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
              onClick={() => setActiveTab("profile")}
              className="h-9 w-9 rounded-full p-0 text-white hover:bg-white/15"
              aria-label="Profile"
            >
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="pt-16 pb-20">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          {/* ── Home Tab ── */}
          <TabsContent value="home" className="space-y-4 p-4 mt-0">
            <AdvancedBooking />

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by subject or tutor name..."
                className="pl-9"
              />
            </div>

            {/* Quick Subject Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {allSubjects.map((subject) => (
                <Badge
                  key={subject}
                  variant={selectedSubject === subject ? "default" : "outline"}
                  className="cursor-pointer whitespace-nowrap"
                  onClick={() => setSelectedSubject(selectedSubject === subject ? "" : subject)}
                >
                  {subject}
                </Badge>
              ))}
              {allSubjects.length === 0 && !tutorsLoading && (
                <p className="text-sm text-muted-foreground">No subjects available yet</p>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>
                  Tutors near {userGeoLocation ? 'your location' : userLocationName}
                  {locationLoading && ' (updating...)'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={getCurrentLocation}
                disabled={locationLoading}
              >
                {locationLoading ? 'Updating...' : 'Update Location'}
              </Button>
            </div>

            {/* Available Tutors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {selectedSubject ? `${selectedSubject} Tutors` : 'Available Tutors'}
                </h3>
                {!tutorsLoading && (
                  <p className="text-sm text-muted-foreground">{tutors.length} found</p>
                )}
              </div>

              {tutorsLoading ? (
                <div className="space-y-3">
                  <TutorCardSkeleton />
                  <TutorCardSkeleton />
                  <TutorCardSkeleton />
                </div>
              ) : tutors.length === 0 ? (
                <EmptyState
                  title={selectedSubject ? `No ${selectedSubject} tutors found` : 'No tutors available'}
                  description={selectedSubject
                    ? 'Try a different subject or clear your filter'
                    : 'Check back soon for available tutors'}
                />
              ) : (
                tutors.map((tutor) => {
                  // Cache isUserOnline result once per tutor card render
                  const online = isUserOnline(tutor.id);
                  return (
                    <Card key={tutor.id} className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar>
                            <AvatarImage src={tutor.avatar_url || "/placeholder.svg"} />
                            <AvatarFallback>
                              {tutor.full_name?.split(' ').map(n => n[0]).join('') || 'T'}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-medium">{tutor.full_name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {tutor.subjects.map(s => s.subject).join(", ")} • {tutor.subjects[0]?.level}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-primary">R{tutor.subjects[0]?.hourly_rate}/hour</p>
                                <p className="text-xs text-muted-foreground">{tutor.distance}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              <StarRating rating={tutor.rating} readonly size="sm" />
                              <span className="text-sm font-medium">{tutor.rating > 0 ? tutor.rating : 'New'}</span>
                              {tutor.totalReviews > 0 && (
                                <span className="text-sm text-muted-foreground">({tutor.totalReviews})</span>
                              )}
                              {online && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                                  Online now
                                </Badge>
                              )}
                            </div>

                            {/* Qualifications */}
                            {tutor.qualifications && tutor.qualifications.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {tutor.qualifications.slice(0, 3).map((q) => (
                                  <Badge key={q.id} variant="outline" className="text-xs">
                                    <Award className="h-3 w-3 mr-1" />
                                    {q.qualification_type}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <div className="grid grid-cols-3 gap-2 mt-3">
                              <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => handleBookTutor(tutor)}
                              >
                                <MapPin className="h-3 w-3 mr-1" />
                                In-Person
                              </Button>
                              <Button
                                variant="default"
                                className="flex-1"
                                onClick={() => handleBookTutor(tutor)}
                              >
                                <Video className="h-4 w-4 mr-1" />
                                Book Online
                              </Button>
                              <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={() => handleStartChat(tutor)}
                              >
                                <MessageCircle className="h-4 w-4 mr-1" />
                                Chat
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* ── Library Tab ── */}
          <TabsContent value="library" className="space-y-4 p-4 mt-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">StudySync Library</h3>
              </div>
              {!academicProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowAcademicSetup(true)}
                >
                  <GraduationCap className="h-3.5 w-3.5 mr-1" />
                  Set Profile
                </Button>
              )}
            </div>
            <StudySyncLibrary
              academicProfile={academicProfile}
              onBookTutor={(tutorId, tutorName) => {
                setSearchQuery(tutorName);
                setActiveTab("home");
                toast({ title: "Find Tutor", description: `Searching for ${tutorName}...` });
              }}
              onNeedHelp={() => setActiveTab("home")}
            />
          </TabsContent>

          {/* ── Activity Tab ── */}
          <TabsContent value="activity" className="space-y-4 p-4 mt-0">
            {/* Bookings needing payment */}
            {bookingsNeedingPayment.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                  </span>
                  Action Required — Complete Payment
                </h3>
                <div className="space-y-3">
                  {bookingsNeedingPayment.map((booking) => (
                    <PendingPaymentCard
                      key={booking.id}
                      booking={booking}
                      onPaymentComplete={() => {}}
                      onStartCheckout={handleStartCheckout}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Sessions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Upcoming Sessions</h3>
                <Badge variant="outline">{bookings.length} active</Badge>
              </div>

              {bookingsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                  <p className="text-muted-foreground">Loading bookings...</p>
                </div>
              ) : bookings.length === 0 ? (
                <Card className="p-6">
                  <div className="text-center text-muted-foreground">
                    <p className="text-sm">No upcoming sessions</p>
                  </div>
                </Card>
              ) : (
                <div className="space-y-3">
                  {bookings.map((booking) => (
                    <LiveBookingCard
                      key={booking.id}
                      booking={booking}
                      userType="learner"
                      onJoinSession={handleJoinVideoSession}
                      onPayNow={handlePayNow}
                      hasPendingPayment={needsPayment(booking.id)}
                      onStartChat={(b) => {
                        setChatWithUserId(b.tutor_id);
                        setChatWithUserName("Tutor");
                        setShowChat(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Past Sessions */}
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Past Sessions</h3>
              {bookings.filter(b => b.status === 'completed' || b.status === 'canceled').length === 0 ? (
                <Card className="p-6">
                  <div className="text-center text-muted-foreground">
                    <p className="text-sm">No past sessions yet</p>
                  </div>
                </Card>
              ) : (
                bookings
                  .filter(b => b.status === 'completed' || b.status === 'canceled')
                  .map((pastBooking) => (
                    <Card key={pastBooking.id} className="mb-3">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{pastBooking.tutor_profile?.full_name || 'Tutor'}</h4>
                            <p className="text-sm text-muted-foreground">{pastBooking.tutor_subjects?.subject}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(pastBooking.scheduled_at).toLocaleDateString()} • {pastBooking.duration_minutes} min
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">R{pastBooking.price}</p>
                            <Badge
                              variant={pastBooking.status === 'completed' ? 'outline' : 'destructive'}
                              className="mt-1"
                            >
                              {pastBooking.status === 'completed' ? 'Completed' : 'Cancelled'}
                            </Badge>
                            {pastBooking.status === 'completed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => {
                                  setReviewData({
                                    bookingId: pastBooking.id,
                                    reviewedId: pastBooking.tutor_id,
                                    reviewedName: pastBooking.tutor_profile?.full_name || 'Tutor',
                                    userType: 'learner',
                                  });
                                  setShowReviewModal(true);
                                }}
                              >
                                Rate & Review
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          </TabsContent>

          {/* ── Profile Tab ── */}
          <TabsContent value="profile" className="space-y-4 p-4 mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <ProfilePhotoUpload
                    userId={session?.user?.id || ''}
                    currentAvatarUrl={profile?.avatar_url}
                    fullName={profile?.full_name}
                    size="md"
                    onUploaded={loadUserProfile}
                  />
                  <div>
                    <h3 className="font-semibold">
                      {profile?.full_name || session?.user?.email?.split('@')[0] || 'Learner'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {profile?.user_type === 'learner' ? 'Student' : 'User'} • {userLocationName}
                    </p>
                    <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Study Level:{' '}
                      {profile?.study_level === 'junior_primary' ? 'Junior Primary (Grades 1–4)' :
                        profile?.study_level === 'senior_primary' ? 'Senior Primary (Grades 5–7)' :
                        profile?.study_level === 'junior_high' ? 'Junior High (Grades 8–9)' :
                        profile?.study_level === 'senior_high' ? 'Senior High (Grades 10–12)' :
                        profile?.study_level === 'tertiary' ? 'College & University' : 'Not set'}
                    </p>
                  </div>
                </div>

                {/* Profile Stats */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-lg font-semibold">
                      {bookings.filter(b => b.status === 'completed').length}
                    </p>
                    <p className="text-xs text-muted-foreground">Sessions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">
                      {bookings.filter(b => b.status === 'confirmed' || b.status === 'requested').length}
                    </p>
                    <p className="text-xs text-muted-foreground">Upcoming</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">
                      R{bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + Number(b.price), 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Spent</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={() => setShowPaymentMethods(true)}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Payment Methods
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab("activity")}>
                    <Clock className="h-4 w-4 mr-2" />
                    Booking History
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab("activity")}>
                    <Star className="h-4 w-4 mr-2" />
                    My Reviews
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Academic Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Academic Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                {academicProfile ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <span className="text-muted-foreground">Curriculum</span>
                      <span className="font-medium">{academicProfile.curriculum || '—'}</span>
                      <span className="text-muted-foreground">Grade</span>
                      <span className="font-medium">{academicProfile.grade || '—'}</span>
                      {academicProfile.exam_year && (
                        <>
                          <span className="text-muted-foreground">Exam Year</span>
                          <span className="font-medium">{academicProfile.exam_year}</span>
                        </>
                      )}
                      {academicProfile.study_level && (
                        <>
                          <span className="text-muted-foreground">Study Level</span>
                          <span className="font-medium">{academicProfile.study_level}</span>
                        </>
                      )}
                      {academicProfile.exam_board && (
                        <>
                          <span className="text-muted-foreground">Exam Board</span>
                          <span className="font-medium">{academicProfile.exam_board}</span>
                        </>
                      )}
                      {academicProfile.school_name && (
                        <>
                          <span className="text-muted-foreground">School</span>
                          <span className="font-medium">{academicProfile.school_name}</span>
                        </>
                      )}
                      {academicProfile.target_grade && (
                        <>
                          <span className="text-muted-foreground">Target Grade</span>
                          <span className="font-medium">{academicProfile.target_grade}</span>
                        </>
                      )}
                      {academicProfile.learning_style && (
                        <>
                          <span className="text-muted-foreground">Learning Style</span>
                          <span className="font-medium">{academicProfile.learning_style}</span>
                        </>
                      )}
                    </div>
                    {academicProfile.subjects && academicProfile.subjects.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Subjects</p>
                        <div className="flex flex-wrap gap-1.5">
                          {academicProfile.subjects.map((s) => (
                            <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {academicProfile.goals && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Goals</p>
                        <p className="text-sm">{academicProfile.goals}</p>
                      </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setShowAcademicSetup(true)}>
                      Edit Profile
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <p className="text-sm text-muted-foreground mb-3">
                      Set your curriculum & subjects to personalise your library.
                    </p>
                    <Button size="sm" onClick={() => setShowAcademicSetup(true)}>
                      <GraduationCap className="h-4 w-4 mr-1" />
                      Set Academic Profile
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Syllabus Manager */}
            {session?.user?.id && (
              <LearnerSyllabusManager
                userId={session.user.id}
                currentStudyLevel={profile?.study_level}
                onProfileUpdated={loadUserProfile}
              />
            )}

            {/* Payment History */}
            {session?.user?.id && (
              <PaymentHistory
                userId={session.user.id}
                limit={5}
                showViewAll
                onViewAll={() => setShowAllPayments(true)}
              />
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab("home")}>
                  Find New Tutor
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab("library")}>
                  Browse Study Materials
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/learner/choose-level')}>
                  Change Study Level
                </Button>
                <Button variant="outline" className="w-full justify-start text-destructive" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ── Bottom Navigation ── */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg">
          <div className="grid grid-cols-4 gap-1 p-2">
            {[
              { id: "home", label: "Home", Icon: Home },
              { id: "library", label: "Library", Icon: BookOpen },
              { id: "activity", label: "Activity", Icon: Activity },
              { id: "profile", label: "Profile", Icon: User },
            ].map(({ id, label, Icon }) => (
              <Button
                key={id}
                variant={activeTab === id ? "default" : "ghost"}
                className="flex flex-col h-auto py-2 px-1"
                onClick={() => setActiveTab(id)}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Modals & Overlays ── */}

      {/* Sign-out confirmation */}
      <ConfirmDialog
        open={showSignOutConfirm}
        onOpenChange={setShowSignOutConfirm}
        title="Sign Out"
        description="Are you sure you want to sign out?"
        onConfirm={confirmSignOut}
      />

      {/* Chat Interface */}
      <ChatInterface
        session={session}
        userType="learner"
        isOpen={showChat}
        onClose={() => { setShowChat(false); setChatWithUserId(null); setChatWithUserName(null); }}
        otherUserId={chatWithUserId || undefined}
        otherUserName={chatWithUserName || undefined}
      />

      {/* Reschedule Dialog */}
      <RescheduleDialog
        booking={rescheduleBooking}
        open={showReschedule}
        onOpenChange={(open) => { setShowReschedule(open); if (!open) setRescheduleBooking(null); }}
        onReschedule={async () => {
          toast({ title: "Session rescheduled!", description: "Your tutor has been notified of the new time." });
        }}
      />

      {/* Payment Methods Modal */}
      {showPaymentMethods && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={() => setShowPaymentMethods(false)}
        >
          <div
            className="bg-background w-full rounded-t-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Payment Methods</h3>
              <button onClick={() => setShowPaymentMethods(false)} className="text-muted-foreground text-sm">✕</button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <CreditCard className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Credit / Debit Card</p>
                  <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex via PayFast</p>
                </div>
                <Badge variant="default" className="bg-green-500">Active</Badge>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <CreditCard className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-sm">EFT / Bank Transfer</p>
                  <p className="text-xs text-muted-foreground">Pay via your bank's online portal</p>
                </div>
                <Badge variant="default" className="bg-green-500">Active</Badge>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <CreditCard className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Instant EFT</p>
                  <p className="text-xs text-muted-foreground">Secure instant bank payment via Ozow</p>
                </div>
                <Badge variant="default" className="bg-green-500">Active</Badge>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <CreditCard className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Mobicred</p>
                  <p className="text-xs text-muted-foreground">Buy now, pay later in instalments</p>
                </div>
                <Badge variant="default" className="bg-green-500">Active</Badge>
              </div>
              {bypassPayments && (
                <div className="flex items-center gap-3 p-3 border border-yellow-300 rounded-lg bg-yellow-50">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  <div className="flex-1">
                    <p className="font-medium text-sm text-yellow-800">Dev Bypass</p>
                    <p className="text-xs text-yellow-600">Payments skipped in dev mode</p>
                  </div>
                  <Badge variant="outline" className="border-yellow-400 text-yellow-700">Dev</Badge>
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center pt-2">
                All payments are processed securely by PayFast, South Africa's trusted payment gateway.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Full Payment History Modal */}
      {showAllPayments && session?.user?.id && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={() => setShowAllPayments(false)}
        >
          <div
            className="bg-background w-full rounded-t-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-background flex items-center justify-between px-5 pt-5 pb-3 border-b">
              <h3 className="font-bold text-lg">Full Payment History</h3>
              <button onClick={() => setShowAllPayments(false)} className="text-muted-foreground text-sm">✕</button>
            </div>
            <div className="p-4">
              <PaymentHistory userId={session.user.id} limit={50} showViewAll={false} />
            </div>
          </div>
        </div>
      )}

      {/* Academic Profile Setup Modal */}
      {showAcademicSetup && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
          onClick={() => setShowAcademicSetup(false)}
        >
          <div
            className="bg-background w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <AcademicProfileSetup
              userId={session?.user?.id || 'dev-user'}
              existingProfile={academicProfile}
              onSave={async (data) => {
                const ok = await saveAcademicProfile(data);
                if (ok) {
                  setShowAcademicSetup(false);
                  toast({ title: "Profile saved!", description: "Your library has been personalised." });
                }
                return ok;
              }}
              saving={academicProfileSaving}
              onSkip={() => setShowAcademicSetup(false)}
              compact
            />
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewData && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => { setShowReviewModal(false); setReviewData(null); }}
          bookingId={reviewData.bookingId}
          reviewedId={reviewData.reviewedId}
          reviewedName={reviewData.reviewedName}
          userType={reviewData.userType}
          onReviewSubmitted={() => {
            toast({ title: "Review Submitted!", description: "Thank you for your feedback." });
          }}
        />
      )}

      {/* Quick Booking Modal */}
      {showBookingModal && selectedTutor && (
        <QuickBookingModal
          isOpen={showBookingModal}
          onClose={() => { setShowBookingModal(false); setSelectedTutor(null); }}
          tutor={selectedTutor}
          onSubmit={createBooking}
        />
      )}
    </div>
  );
};

export default LearnerApp;
