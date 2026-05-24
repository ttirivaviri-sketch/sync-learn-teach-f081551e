/**
 * LearnerApp — Shell component.
 *
 * Owns: auth, tab state, full-screen overlays (video / checkout / launch),
 *       header, bottom nav, and cross-cutting modals.
 * Delegates each tab's UI to a focused sub-component.
 */
import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Home, BookOpen, Activity, User, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AppShell } from "@/components/layout/AppShell";
import VideoMeeting from "@/components/VideoMeeting";
import LaunchScreen from "@/components/LaunchScreen";
import ChatInterface from "@/components/ChatInterface";
import ReviewModal from "@/components/ReviewModal";
import { LoadingScreen } from "@/components/LoadingSpinner";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { QuickBookingModal } from "@/components/QuickBookingModal";
import { PaymentCheckout } from "@/components/PaymentCheckout";
import { RescheduleDialog } from "@/components/RescheduleDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { analytics } from "@/utils/analytics";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { useTutorData, TutorProfile } from "@/hooks/useTutorData";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePresenceTracking } from "@/hooks/usePresenceTracking";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useBookingPayments } from "@/hooks/useBookingPayments";
import { useAcademicProfile } from "@/hooks/useAcademicProfile";

// ── Tab sub-components (lazy-loaded so only the active tab mounts its hook tree) ──
const LearnerHomeTab = lazy(() => import("./learner/LearnerHomeTab").then(m => ({ default: m.LearnerHomeTab })));
const LearnerLibraryTab = lazy(() => import("./learner/LearnerLibraryTab").then(m => ({ default: m.LearnerLibraryTab })));
const LearnerActivityTab = lazy(() => import("./learner/LearnerActivityTab").then(m => ({ default: m.LearnerActivityTab })));
const LearnerProfileTab = lazy(() => import("./learner/LearnerProfileTab").then(m => ({ default: m.LearnerProfileTab })));
import { logger } from "@/utils/logger";
import { PaymentMethodsModal } from "@/components/learner-modals/PaymentMethodsModal";
import { PaymentHistoryModal } from "@/components/learner-modals/PaymentHistoryModal";
import { AcademicSetupModal } from "@/components/learner-modals/AcademicSetupModal";

const TabFallback = () => (
  <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading…</div>
);

// ── Types ───────────────────────────────────────────────────────────────────
interface UserProfile {
  id: string;
  full_name?: string;
  email?: string;
  user_type?: string;
  study_level?: string;
  avatar_url?: string;
  onboarding_completed_at?: string | null;
}

interface VideoMeetingData {
  partnerName: string;
  subject: string;
  booking: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
const LearnerApp = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();

  // ── Auth ────────────────────────────────────────────────────────────────
  const { session, loading } = useAuth({ redirectTo: "/learner/auth" });

  // ── UI state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("home");
  const [showLaunchScreen, setShowLaunchScreen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Full-screen overlays
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
  const [videoMeetingData, setVideoMeetingData] = useState<VideoMeetingData | null>(null);
  const [checkoutBooking, setCheckoutBooking] = useState<any>(null);

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [chatWithUserId, setChatWithUserId] = useState<string | null>(null);
  const [chatWithUserName, setChatWithUserName] = useState<string | null>(null);

  // Modal state
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState<{
    id: string; name: string; subject: string; level: string;
    price: number; subjectId: string; avatar?: string;
  } | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState<any>(null);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [showAcademicSetup, setShowAcademicSetup] = useState(false);
  const [profileSetupDismissed, setProfileSetupDismissed] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState<{
    bookingId: string; reviewedId: string; reviewedName: string;
    userType: "learner" | "tutor";
  } | null>(null);

  // ── Data hooks ──────────────────────────────────────────────────────────
  const userId = session?.user?.id;

  const {
    bookings, loading: bookingsLoading,
    createBooking, updateBookingStatus, getUpcomingSessions,
  } = useRealtimeBookings("learner", userId);

  const { location: userGeoLocation, getCurrentLocation, loading: locationLoading } = useGeolocation();
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  const {
    profile: academicProfile, loading: academicProfileLoading,
    saving: academicProfileSaving, saveProfile: saveAcademicProfile,
  } = useAcademicProfile(userId);

  const { tutors, allSubjects, loading: tutorsLoading, refreshTutors } = useTutorData(userGeoLocation, {
    subjectFilter: selectedSubject,
    searchQuery: debouncedSearchQuery,
    studyLevel: profile?.study_level || undefined,
    subjects: academicProfile?.subjects || undefined,
    grade: academicProfile?.grade || undefined,
    curriculum: academicProfile?.curriculum || undefined,
  });
  const { isUserOnline } = usePresenceTracking(session);

  const confirmedBookingIds = useMemo(
    () => bookings.filter((b) => b.status === "confirmed").map((b) => b.id),
    [bookings],
  );
  const { needsPayment } = useBookingPayments(confirmedBookingIds);
  const bookingsNeedingPayment = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.status === "confirmed" &&
          (b as any).source !== "admin_allocated" &&
          needsPayment(b.id)
      ),
    [bookings, needsPayment],
  );

  // ── Profile & analytics ────────────────────────────────────────────────
  useEffect(() => { analytics.pageView("learner-app"); }, []);

  useEffect(() => {
    if (session?.user) {
      loadUserProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Redirect users who haven't completed onboarding (academic profile + flag).
  // IMPORTANT: only redirect when we have a *successful* profile load — a
  // transient network error leaves `profile`/`academicProfile` null and would
  // otherwise wrongly bounce a fully-onboarded user back to /learner/onboarding.
  // We also persist the last known onboarding-completed timestamp per user so
  // a failed fetch on a returning user does not trigger a false redirect.
  const onboardingCacheKey = session?.user?.id
    ? `learner_onboarding_completed_at:${session.user.id}`
    : null;
  const redirectedToOnboardingRef = useRef(false);
  useEffect(() => {
    if (redirectedToOnboardingRef.current) return;
    if (loading || academicProfileLoading || !profileLoaded) return;
    if (!session?.user) return;

    const cachedCompletedAt = onboardingCacheKey
      ? localStorage.getItem(onboardingCacheKey)
      : null;

    const guardOutcome = {
      profileLoaded,
      profileFetched: !!profile,
      onboarding_completed_at: profile?.onboarding_completed_at ?? null,
      cachedCompletedAt,
      academicProfileLoaded: !academicProfileLoading,
      academicProfilePresent: !!academicProfile,
    };

    // Profile fetch failed — fall back to cached onboarding flag if present.
    if (!profile) {
      const decision = cachedCompletedAt ? "skip_cached_completed" : "skip_no_profile";
      analytics.track("learner_redirect_guard", { ...guardOutcome, decision });
      logger.info("[LearnerApp] Redirect guard:", decision, guardOutcome);
      return;
    }

    if (profile.onboarding_completed_at) {
      if (onboardingCacheKey) {
        localStorage.setItem(onboardingCacheKey, profile.onboarding_completed_at);
      }
      analytics.track("learner_redirect_guard", { ...guardOutcome, decision: "skip_completed" });
      return;
    }
    if (academicProfile) {
      analytics.track("learner_redirect_guard", { ...guardOutcome, decision: "skip_has_academic" });
      return;
    }

    analytics.track("learner_redirect_guard", { ...guardOutcome, decision: "redirect_to_onboarding" });
    logger.warn("[LearnerApp] Redirecting to onboarding", guardOutcome);
    redirectedToOnboardingRef.current = true;
    navigate("/learner/onboarding", { replace: true });
  }, [loading, academicProfileLoading, profileLoaded, academicProfile, session?.user, navigate, profile, onboardingCacheKey]);

  // Listen for custom toast events from StudySyncLibrary
  useEffect(() => {
    const handler = (event: CustomEvent<{ title: string; description: string }>) => {
      toast({ title: event.detail.title, description: event.detail.description });
    };
    window.addEventListener("show-toast", handler as EventListener);
    return () => window.removeEventListener("show-toast", handler as EventListener);
  }, [toast]);

  useEffect(() => { analytics.track("tab_changed", { tab: activeTab }); }, [activeTab]);

  // ── Handlers ────────────────────────────────────────────────────────────
  // Retry profile load with exponential backoff so we only mark profileLoaded
  // after a successful fetch (or after exhausting retries on a real failure).
  const loadUserProfile = async () => {
    if (!session?.user?.id) return;
    const userIdLocal = session.user.id;
    const maxAttempts = 4;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data, error } = await supabase
          .from("profiles").select("*").eq("id", userIdLocal).single();

        if (error && error.code !== "PGRST116") throw error;

        setProfile(data);
        setProfileLoaded(true);

        if (data?.onboarding_completed_at) {
          localStorage.setItem(
            `learner_onboarding_completed_at:${userIdLocal}`,
            data.onboarding_completed_at,
          );
        }

        analytics.track("learner_profile_loaded", {
          attempt,
          onboarding_completed_at: data?.onboarding_completed_at ?? null,
          study_level: data?.study_level ?? null,
        });

        if (!data?.study_level) {
          toast({ title: "Select your study level", description: "Choose your level to personalize your search." });
          navigate("/learner/choose-level");
        }
        return;
      } catch (err) {
        lastError = err;
        logger.warn(`[LearnerApp] Profile load attempt ${attempt}/${maxAttempts} failed:`, err);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt - 1)));
        }
      }
    }

    logger.error("[LearnerApp] Profile load failed after retries:", lastError);
    analytics.track("learner_profile_load_failed", { attempts: maxAttempts });
    // Mark loaded so the UI proceeds; the redirect guard will fall back to
    // the cached onboarding flag (if any) rather than bouncing the user.
    setProfileLoaded(true);
  };

  const handleSignOut = () => setShowSignOutConfirm(true);

  const confirmSignOut = async () => {
    try {
      analytics.track("user_signout", { userType: "learner" });
      await supabase.auth.signOut();
      toast({ title: "Signed out successfully", description: "You have been logged out of your learner account." });
      navigate("/learner/auth");
    } catch (error) {
      analytics.error(error as Error, "sign_out_failed");
      toast({ title: "Error", description: "Failed to sign out. Please try again.", variant: "destructive" });
    } finally {
      setShowSignOutConfirm(false);
    }
  };

  const handleBookTutor = (tutor: TutorProfile) => {
    if (!isOnline) {
      toast({ title: "No connection", description: "Please check your internet connection to book sessions.", variant: "destructive" });
      return;
    }
    if (!session?.user) {
      toast({ title: "Authentication required", description: "Please sign in to book sessions.", variant: "destructive" });
      navigate("/learner/auth");
      return;
    }
    if (!tutor.subjects || tutor.subjects.length === 0) {
      toast({ title: "No subjects available", description: "This tutor hasn't set up their subjects yet.", variant: "destructive" });
      return;
    }
    analytics.track("booking_initiated", { tutorId: tutor.id });
    const s = tutor.subjects[0];
    setSelectedTutor({ id: tutor.id, name: tutor.full_name || "Tutor", subject: s.subject, level: s.level, price: s.hourly_rate, subjectId: s.id, avatar: tutor.avatar_url });
    setShowBookingModal(true);
  };

  const handleLibraryBookTutor = async (tutorId: string, tutorName: string) => {
    const matched = tutors.find((t) => t.id === tutorId);
    if (matched && matched.subjects?.length > 0) {
      const s = matched.subjects[0];
      setSelectedTutor({ id: matched.id, name: matched.full_name || tutorName, subject: s.subject, level: s.level, price: s.hourly_rate, subjectId: s.id, avatar: matched.avatar_url });
      setShowBookingModal(true);
    } else {
      const { data: ts } = await supabase
        .from("tutor_subjects").select("id, subject, level, hourly_rate").eq("user_id", tutorId).limit(1);
      if (ts && ts.length > 0) {
        const s = ts[0];
        setSelectedTutor({ id: tutorId, name: tutorName, subject: s.subject, level: s.level, price: s.hourly_rate || 0, subjectId: s.id });
        setShowBookingModal(true);
      } else {
        setSearchQuery(tutorName);
        setActiveTab("home");
        toast({ title: "Find Tutor", description: `Searching for ${tutorName}...` });
      }
    }
  };

  const handleSessionAction = (action: string) => {
    if (action === "join") {
      const up = getUpcomingSessions();
      if (up.length === 0) {
        toast({ title: "No Session Found", description: "Unable to find an upcoming session to join.", variant: "destructive" });
        return;
      }
      const n = up[0];
      setVideoMeetingData({
        partnerName: (n.tutor_profile as { full_name?: string })?.full_name || "Tutor",
        subject: (n.tutor_subjects as { subject?: string })?.subject || "Study Session",
        booking: n as unknown as Record<string, unknown>,
      });
      setShowVideoMeeting(true);
      return;
    }
    if (action === "reschedule") {
      const up = getUpcomingSessions();
      if (up.length > 0) { setRescheduleBooking(up[0]); setShowReschedule(true); }
      else { toast({ title: "No upcoming sessions", description: "Nothing to reschedule right now." }); }
      return;
    }
    toast({ title: "Cancel Session", description: "Session cancellation processed", variant: "destructive" });
  };

  const handleJoinVideoSession = (booking: unknown) => {
    const b = booking as { id?: string; tutor_profile?: { full_name?: string }; tutor_subjects?: { subject?: string } };
    if (!b?.id) {
      toast({ title: "Invalid Session", description: "Unable to join session. Missing booking information.", variant: "destructive" });
      return;
    }
    setVideoMeetingData({ partnerName: b.tutor_profile?.full_name || "Tutor", subject: b.tutor_subjects?.subject || "Study Session", booking: booking as Record<string, unknown> });
    setShowVideoMeeting(true);
  };

  const handlePayNow = (booking: unknown) => {
    setCheckoutBooking(booking);
  };

  const handleStartCheckout = (booking: any) => {
    setCheckoutBooking(booking);
  };

  const handleStartChat = (tutor: { id: string | number; full_name?: string; name?: string }) => {
    setChatWithUserId(tutor.id.toString());
    setChatWithUserName(tutor.full_name || tutor.name || "Tutor");
    setShowChat(true);
  };

  // ── Early returns ──────────────────────────────────────────────────────
  if (loading) return <LoadingScreen message="Loading your account..." />;
  if (!session?.user) return null;
  if (showLaunchScreen) return <LaunchScreen onComplete={() => setShowLaunchScreen(false)} />;

  if (checkoutBooking) {
     return (
      <PaymentCheckout
        booking={checkoutBooking}
        onBack={() => setCheckoutBooking(null)}
        onPaymentInitiated={(booking) => {
          setCheckoutBooking(null);
          const now = Date.now();
          const startTime = new Date(booking.scheduled_at).getTime();
          const endTime = startTime + booking.duration_minutes * 60000;
          const joinWindowStart = startTime - 15 * 60000;

          if (now >= joinWindowStart && now < endTime) {
            setVideoMeetingData({
              partnerName: booking.tutor_profile?.full_name || "Tutor",
              subject: booking.tutor_subjects?.subject || "Study Session",
              booking: booking as unknown as Record<string, unknown>,
            });
            setShowVideoMeeting(true);
          } else {
            toast({
              title: "Payment confirmed!",
              description: "Your session will be available to join closer to the scheduled time.",
            });
          }
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
        onEndCall={() => { setShowVideoMeeting(false); setVideoMeetingData(null); }}
      />
    );
  }

  // ── Nav items ────────────────────────────────────────────────────────────
  const navItems = [
    { id: "home",     label: "Home",     icon: <Home     className="h-5 w-5" /> },
    { id: "library",  label: "Library",  icon: <BookOpen className="h-5 w-5" /> },
    { id: "activity", label: "Activity", icon: <Activity className="h-5 w-5" /> },
    { id: "profile",  label: "Profile",  icon: <User     className="h-5 w-5" /> },
  ];

  // ── Render (shell: header + tabs + bottom nav + modals) ────────────────
  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      navItems={navItems}
      headerLeft={
        <p
          className="hidden sm:block truncate text-[10px] font-medium uppercase tracking-[0.12em]"
          style={{ color: "rgba(255,255,255,0.82)" }}
        >
          Education, in sync with your future
        </p>
      }
      headerRight={
        <>
          <NotificationCenter />
          <Button variant="ghost" size="sm" onClick={() => setShowChat(true)} className="h-9 w-9 rounded-full p-0 text-white hover:bg-white/15" aria-label="Open Chat">
            <MessageCircle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setActiveTab("profile")} className="h-9 w-9 rounded-full p-0 text-white hover:bg-white/15 lg:hidden" aria-label="Profile">
            <User className="h-5 w-5" />
          </Button>
        </>
      }
    >
      {/* ── Content: max-width container for desktop ── */}
      <div className="lg:max-w-screen-xl lg:mx-auto lg:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="home" forceMount={activeTab === "home" ? true : undefined} hidden={activeTab !== "home"}>
            {activeTab === "home" && (
              <Suspense fallback={<TabFallback />}>
                <LearnerHomeTab
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  allSubjects={allSubjects}
                  selectedSubject={selectedSubject}
                  onSelectSubject={setSelectedSubject}
                  userGeoLocation={userGeoLocation ? { lat: userGeoLocation.latitude, lng: userGeoLocation.longitude } : null}
                  locationLoading={locationLoading}
                  onUpdateLocation={getCurrentLocation}
                  tutors={tutors}
                  tutorsLoading={tutorsLoading}
                  onRefreshTutors={refreshTutors}
                  onBookTutor={handleBookTutor}
                  onStartChat={handleStartChat}
                  isUserOnline={isUserOnline}
                  upcomingBookings={bookings.filter((b) => (b.status === "confirmed" || b.status === "requested") && (new Date(b.scheduled_at).getTime() + b.duration_minutes * 60000) > Date.now())}
                  needsPayment={needsPayment}
                  onJoinVideoSession={handleJoinVideoSession}
                  onPayNow={handlePayNow}
                  onStartCheckout={handleStartCheckout}
                />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent value="library" hidden={activeTab !== "library"}>
            {activeTab === "library" && (
              <Suspense fallback={<TabFallback />}>
                <LearnerLibraryTab
                  academicProfile={academicProfile}
                  onShowAcademicSetup={() => setShowAcademicSetup(true)}
                  onBookTutor={handleLibraryBookTutor}
                  onNeedHelp={() => setActiveTab("home")}
                />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent value="activity" hidden={activeTab !== "activity"}>
            {activeTab === "activity" && (
              <Suspense fallback={<TabFallback />}>
                <LearnerActivityTab
                  bookings={bookings}
                  bookingsLoading={bookingsLoading}
                  bookingsNeedingPayment={bookingsNeedingPayment}
                  needsPayment={needsPayment}
                  onJoinVideoSession={handleJoinVideoSession}
                  onPayNow={handlePayNow}
                  onStartCheckout={handleStartCheckout}
                  onStartChat={(booking) => {
                    setChatWithUserId(booking.tutor_id);
                    setChatWithUserName("Tutor");
                    setShowChat(true);
                  }}
                  onReview={(data) => { setReviewData(data); setShowReviewModal(true); }}
                />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent value="profile" hidden={activeTab !== "profile"}>
            {activeTab === "profile" && (
              <Suspense fallback={<TabFallback />}>
                <LearnerProfileTab
                  session={session}
                  profile={profile}
                  academicProfile={academicProfile}
                  bookings={bookings}
                  onRefreshProfile={loadUserProfile}
                  onShowAcademicSetup={() => setShowAcademicSetup(true)}
                  onShowPaymentMethods={() => setShowPaymentMethods(true)}
                  onShowAllPayments={() => setShowAllPayments(true)}
                  onNavigateTab={setActiveTab}
                  onSignOut={handleSignOut}
                  onNavigate={navigate}
                />
              </Suspense>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Modals & Overlays (rendered inside shell wrapper so theme applies) ── */}
      <ConfirmDialog
        open={showSignOutConfirm}
        onOpenChange={setShowSignOutConfirm}
        title="Sign Out"
        description="Are you sure you want to sign out?"
        onConfirm={confirmSignOut}
      />

      <ChatInterface
        session={session}
        userType="learner"
        isOpen={showChat}
        onClose={() => { setShowChat(false); setChatWithUserId(null); setChatWithUserName(null); }}
        otherUserId={chatWithUserId || undefined}
        otherUserName={chatWithUserName || undefined}
      />

      <RescheduleDialog
        booking={rescheduleBooking}
        open={showReschedule}
        onOpenChange={(open) => { setShowReschedule(open); if (!open) setRescheduleBooking(null); }}
        onReschedule={async () => {
          toast({ title: "Session rescheduled!", description: "Your tutor has been notified of the new time." });
        }}
      />

      <PaymentMethodsModal
        open={showPaymentMethods}
        onClose={() => setShowPaymentMethods(false)}
      />

      {session?.user?.id && (
        <PaymentHistoryModal
          open={showAllPayments}
          onClose={() => setShowAllPayments(false)}
          userId={session.user.id}
        />
      )}

      <AcademicSetupModal
        open={showAcademicSetup}
        onClose={() => { setShowAcademicSetup(false); setProfileSetupDismissed(true); }}
        userId={session?.user?.id || ""}
        academicProfile={academicProfile}
        saving={academicProfileSaving}
        onSave={async (data) => {
          const ok = await saveAcademicProfile(data);
          if (!ok) {
            toast({ title: "Save failed", description: "Please try again or check your connection.", variant: "destructive" });
          }
          return ok;
        }}
        onSaved={() => {
          setShowAcademicSetup(false);
          setProfileSetupDismissed(true);
          toast({ title: "Profile saved!", description: "Your library and Study Mode have been personalised." });
          setActiveTab("library");
        }}
      />

      {/* Review Modal */}
      {reviewData && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => { setShowReviewModal(false); setReviewData(null); }}
          bookingId={reviewData.bookingId}
          reviewedId={reviewData.reviewedId}
          reviewedName={reviewData.reviewedName}
          userType={reviewData.userType}
          onReviewSubmitted={() => { toast({ title: "Review Submitted!", description: "Thank you for your feedback." }); }}
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
    </AppShell>
  );
};

export default LearnerApp;
