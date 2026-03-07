import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Home, BookOpen, Activity, MapPin, Star, Clock, CreditCard, User, Video, ShoppingBag, LogOut, MessageCircle, Search, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import LearnerSyllabusManager from '@/components/LearnerSyllabusManager';
import { useLearnerSubjects } from '@/hooks/useLearnerSubjects';
import { ProfilePhotoUpload } from '@/components/ProfilePhotoUpload';

const LearnerApp = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
  const [videoMeetingData, setVideoMeetingData] = useState<any>(null);
  const [showLaunchScreen, setShowLaunchScreen] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [userLocationName, setUserLocationName] = useState("Johannesburg Central");
  const [profile, setProfile] = useState<any>(null);
  const [upcomingSession, setUpcomingSession] = useState<any>(null);
  const [bookingRequests, setBookingRequests] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatWithUserId, setChatWithUserId] = useState<string | null>(null);
  const [chatWithUserName, setChatWithUserName] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState<any>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState<any>(null);
  const [showPaymentForBooking, setShowPaymentForBooking] = useState<any>(null);
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

  // Initialize geolocation, tutor data and presence tracking  
  const { location: userGeoLocation, getCurrentLocation, loading: locationLoading } = useGeolocation();
  const { tutors, allSubjects, loading: tutorsLoading, refreshTutors } = useTutorData(userGeoLocation, {
    subjectFilter: selectedSubject,
    searchQuery: searchQuery,
    studyLevel: profile?.study_level || undefined,
  });
  const { isUserOnline } = usePresenceTracking(session);

  // Get confirmed bookings that need payment
  const confirmedBookingIds = bookings
    .filter(b => b.status === 'confirmed')
    .map(b => b.id);
  const { needsPayment, isPaid } = useBookingPayments(confirmedBookingIds);

  // Get bookings that need payment (confirmed but not paid)
  const bookingsNeedingPayment = bookings.filter(
    b => b.status === 'confirmed' && needsPayment(b.id)
  );

  useEffect(() => {
    analytics.pageView('learner-app');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);
        if (!session?.user && !loading) {
          navigate("/learner/auth");
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session?.user) {
        navigate("/learner/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, loading]);

  // Load user profile and upcoming sessions
  useEffect(() => {
    if (session?.user) {
      loadUserProfile();
      loadUpcomingSession();
      requestLocation();
    }
  }, [session]);

  // Listen for custom toast events from StudySyncLibrary
  useEffect(() => {
    const handleToastEvent = (event: any) => {
      toast({
        title: event.detail.title,
        description: event.detail.description,
      });
    };

    window.addEventListener('show-toast', handleToastEvent);
    return () => window.removeEventListener('show-toast', handleToastEvent);
  }, [toast]);

  // Track tab changes
  useEffect(() => {
    analytics.track('tab_changed', { tab: activeTab });
  }, [activeTab]);

  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session?.user?.id)
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

  const loadUpcomingSession = async () => {
    // Upcoming session is now derived from real-time bookings
    const upcoming = getUpcomingSessions();
    if (upcoming.length > 0) {
      const next = upcoming[0];
      setUpcomingSession({
        tutor: next.tutor_profile?.full_name || 'Tutor',
        subject: `${next.tutor_subjects?.subject || 'Session'} • ${next.tutor_subjects?.level || ''}`,
        time: new Date(next.scheduled_at).toLocaleString(),
        price: `R${next.price}/hour`,
        sessionId: next.id,
      });
    } else {
      setUpcomingSession(null);
    }
  };

  const requestLocation = () => {
    getCurrentLocation();
  };

  // Real tutor data is now handled by useTutorData hook

  const handleSignOut = () => {
    setShowSignOutConfirm(true);
  };

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

  const handleBookInPerson = (tutor: TutorProfile) => {
    if (!isOnline) {
      toast({
        title: "No connection",
        description: "Please check your internet connection to book sessions.",
        variant: "destructive",
      });
      return;
    }

    // Check if user is authenticated before booking
    if (!session?.user) {
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

    analytics.track('booking_initiated', { type: 'in-person', tutorId: tutor.id });
    
    const firstSubject = tutor.subjects[0];
    setSelectedTutor({
      id: tutor.id,
      name: tutor.full_name || 'Tutor',
      subject: firstSubject.subject,
      level: firstSubject.level,
      price: firstSubject.hourly_rate,
      subjectId: firstSubject.id,
      avatar: tutor.avatar_url
    });
    setShowBookingModal(true);
  };

  const handleBookOnline = (tutor: TutorProfile) => {
    // Check if user is authenticated before booking
    if (!session?.user) {
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

    analytics.track('booking_initiated', { type: 'online', tutorId: tutor.id });
    
    const firstSubject = tutor.subjects[0];
    setSelectedTutor({
      id: tutor.id,
      name: tutor.full_name || 'Tutor',
      subject: firstSubject.subject,
      level: firstSubject.level,
      price: firstSubject.hourly_rate,
      subjectId: firstSubject.id,
      avatar: tutor.avatar_url
    });
    setShowBookingModal(true);
  };

  const handleSessionAction = (action: string) => {
    if (action === "join") {
      // Get the actual upcoming booking from real-time data
      const upcomingSessions = getUpcomingSessions();
      const nextSession = upcomingSessions.length > 0 ? upcomingSessions[0] : null;
      
      if (!nextSession) {
        console.error('❌ No upcoming session found');
        toast({
          title: "No Session Found",
          description: "Unable to find an upcoming session to join.",
          variant: "destructive",
        });
        return;
      }

      console.log('🎥 Learner joining session with booking ID:', nextSession.id);
      
      setVideoMeetingData({
        partnerName: nextSession.tutor_profile?.full_name || "Tutor",
        subject: nextSession.tutor_subjects?.subject || "Study Session",
        booking: nextSession
      });
      setShowVideoMeeting(true);
      return;
    }
    
    toast({
      title: action === "reschedule" ? "Reschedule Session" : "Cancel Session",
      description: action === "reschedule" 
        ? "Reschedule options will be available soon" 
        : "Session cancellation processed",
      variant: action === "cancel" ? "destructive" : "default"
    });
  };

  const handleJoinVideoSession = (booking: any) => {
    if (!booking?.id) {
      console.error('❌ No booking ID provided to handleJoinVideoSession');
      toast({
        title: "Invalid Session",
        description: "Unable to join session. Missing booking information.",
        variant: "destructive",
      });
      return;
    }

    console.log('🎥 Learner joining video session with booking ID:', booking.id);
    
    setVideoMeetingData({
      partnerName: booking.tutor_profile?.full_name || "Tutor",
      subject: booking.tutor_subjects?.subject || "Study Session",
      booking: booking
    });
    setShowVideoMeeting(true);
  };

  // handleRateAndReview is now inline in the past sessions section

  const handlePayNow = (booking: any) => {
    setShowPaymentForBooking(booking);
    setActiveTab("activity");
  };

  const handleQuickProfileAction = (action: string) => {
    toast({
      title: action,
      description: "Feature coming soon!",
    });
  };

  const handleStartChat = (tutor: any) => {
    setChatWithUserId(tutor.id.toString());
    setChatWithUserName(tutor.name);
    setShowChat(true);
  };

  if (loading) {
    return <LoadingScreen message="Loading your account..." />;
  }

  if (!session?.user) {
    return null; // Will redirect to auth
  }

  if (showLaunchScreen) {
    return <LaunchScreen onComplete={() => setShowLaunchScreen(false)} />;
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="text-white shadow-md"
        style={{
          background: "linear-gradient(135deg, #1a3fc4 0%, #2d52e0 50%, #3b63f5 100%)",
        }}
      >
        {/* Row 1: Logo + Icons */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          {/* Logo */}
          <div className="flex items-center shrink-0">
            <img
              src="/lovable-uploads/studysync-logo.png"
              alt="StudySync"
              className="w-auto object-contain"
              style={{ height: "175px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }}
            />
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChat(true)}
              className="text-white hover:bg-white/15 rounded-full w-10 h-10 p-0 flex items-center justify-center"
              aria-label="Open Chat"
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("profile")}
              className="text-white hover:bg-white/15 rounded-full w-10 h-10 p-0 flex items-center justify-center"
              aria-label="Profile"
            >
              <User className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Row 2: Slogan */}
        <div className="px-5 pt-0 pb-4">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-2"
            style={{ color: "rgba(255,255,255,0.7)", letterSpacing: "0.12em" }}
          >
            Education, in sync with your future
          </p>
          <h1
            className="text-2xl font-extrabold leading-tight text-white"
          >
            Confidence Starts Here
          </h1>
          {!isOnline && (
            <span className="inline-block mt-1 text-xs font-medium bg-red-500/80 text-white px-2 py-0.5 rounded-full">
              Offline
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="pb-20">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          {/* Home Tab - Search Content */}
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

            {/* Quick Filters - Dynamic from DB */}
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

            {/* Location with refresh button */}
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
                onClick={requestLocation}
                disabled={locationLoading}
              >
                {locationLoading ? 'Updating...' : 'Update Location'}
              </Button>
            </div>

            {/* Available Tutors - filtered by hook */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {selectedSubject ? `${selectedSubject} Tutors` : 'Available Tutors'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tutors.length} tutors found
                </p>
              </div>
              {tutorsLoading ? (
                <div className="text-center py-4">Loading tutors...</div>
              ) : tutors.length === 0 ? (
                <EmptyState
                  title={selectedSubject ? `No ${selectedSubject} tutors found` : 'No tutors available'}
                  description={selectedSubject 
                    ? 'Try a different subject or clear your filter' 
                    : 'Check back soon for available tutors'}
                />
              ) : (
                tutors.map((tutor) => (
                <Card key={tutor.id} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar>
                        <AvatarImage src={tutor.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback>{tutor.full_name?.split(' ').map(n => n[0]).join('') || 'T'}</AvatarFallback>
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
                        
                        <div className="flex items-center gap-1 mt-2">
                          <StarRating rating={tutor.rating} readonly size="sm" />
                          <span className="text-sm font-medium">{tutor.rating > 0 ? tutor.rating : 'New'}</span>
                          {tutor.totalReviews > 0 && (
                            <span className="text-sm text-muted-foreground">({tutor.totalReviews})</span>
                          )}
                          {isUserOnline(tutor.id) && (
                            <Badge variant="secondary" className="ml-2 text-xs">Available</Badge>
                          )}
                          {isUserOnline(tutor.id) && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
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
                            onClick={() => handleBookInPerson(tutor)}
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            In-Person
                          </Button>
                          <Button 
                            variant="default"
                            className="flex-1"
                            onClick={() => handleBookOnline(tutor)}
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
              ))
              )}
            </div>
          </TabsContent>

          {/* Library Tab */}
          <TabsContent value="library" className="space-y-4 p-4 mt-0">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">StudySync Library</h3>
            </div>
            <StudySyncLibrary />
          </TabsContent>

          {/* Activity Tab - Bookings and History Combined */}
          <TabsContent value="activity" className="space-y-4 p-4 mt-0">
            {/* Pending Payments Section */}
            {showPaymentForBooking && (
              <div className="mb-4">
                <PendingPaymentCard 
                  booking={showPaymentForBooking}
                  onPaymentComplete={() => setShowPaymentForBooking(null)}
                />
              </div>
            )}

            {!showPaymentForBooking && bookingsNeedingPayment.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                  Action Required - Complete Payment
                </h3>
                <div className="space-y-3">
                  {bookingsNeedingPayment.map((booking) => (
                    <PendingPaymentCard 
                      key={booking.id}
                      booking={booking}
                      onPaymentComplete={() => {}}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Bookings Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Upcoming Sessions</h3>
                <Badge variant="outline">{bookings.length} active</Badge>
              </div>
              
              {bookingsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
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
                      onStartChat={(booking) => {
                        setChatWithUserId(booking.tutor_id);
                        setChatWithUserName("Tutor");
                        setShowChat(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Past Sessions Section - from real bookings */}
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
                            <Badge variant={pastBooking.status === 'completed' ? 'outline' : 'destructive'} className="mt-1">
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
                                    userType: 'learner'
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

          {/* Profile Tab */}
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
                    onUploaded={() => loadUserProfile()}
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
                      Study Level: {
                        profile?.study_level === 'junior_primary' ? 'Junior Primary (Grades 1-4)' :
                        profile?.study_level === 'senior_primary' ? 'Senior Primary (Grades 5-7)' :
                        profile?.study_level === 'junior_high' ? 'Junior High (Grades 8-9)' :
                        profile?.study_level === 'senior_high' ? 'Senior High (Grades 10-12)' :
                        profile?.study_level === 'tertiary' ? 'College & University' : 'Not set'
                      }
                    </p>
                  </div>
                </div>

                {/* Profile Stats - from real bookings */}
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
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => toast({ title: "Feature coming soon!", description: "Payment methods will be available in the next update." })}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Payment Methods
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setActiveTab("activity")}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Booking History
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => toast({ title: "Feature coming soon!", description: "Review system will be available in the next update." })}
                  >
                    <Star className="h-4 w-4 mr-2" />
                    My Reviews
                  </Button>
                </div>
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

            {/* Payment History Section */}
            {session?.user?.id && (
              <PaymentHistory
                userId={session.user.id}
                limit={5}
                showViewAll={true}
                onViewAll={() => toast({ title: "Full History", description: "Complete payment history coming soon!" })}
              />
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setActiveTab("home")}
                >
                  Find New Tutor
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setActiveTab("library")}
                >
                  Browse Study Materials
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/learner/choose-level')}
                >
                  Change Study Level
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg">
          <div className="grid grid-cols-4 gap-1 p-2">
            <Button
              variant={activeTab === "home" ? "default" : "ghost"}
              className="flex flex-col h-auto py-2 px-1"
              onClick={() => setActiveTab("home")}
            >
              <Home className="h-5 w-5 mb-1" />
              <span className="text-xs">Home</span>
            </Button>
            <Button
              variant={activeTab === "library" ? "default" : "ghost"}
              className="flex flex-col h-auto py-2 px-1"
              onClick={() => setActiveTab("library")}
            >
              <BookOpen className="h-5 w-5 mb-1" />
              <span className="text-xs">Library</span>
            </Button>
            <Button
              variant={activeTab === "activity" ? "default" : "ghost"}
              className="flex flex-col h-auto py-2 px-1"
              onClick={() => setActiveTab("activity")}
            >
              <Activity className="h-5 w-5 mb-1" />
              <span className="text-xs">Activity</span>
            </Button>
            <Button
              variant={activeTab === "profile" ? "default" : "ghost"}
              className="flex flex-col h-auto py-2 px-1"
              onClick={() => setActiveTab("profile")}
            >
              <User className="h-5 w-5 mb-1" />
              <span className="text-xs">Profile</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <ChatInterface
        session={session}
        userType="learner"
        isOpen={showChat}
        onClose={() => {
          setShowChat(false);
          setChatWithUserId(null);
          setChatWithUserName(null);
        }}
        otherUserId={chatWithUserId || undefined}
        otherUserName={chatWithUserName || undefined}
      />

      {/* Review Modal */}
      {reviewData && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setReviewData(null);
          }}
          bookingId={reviewData.bookingId}
          reviewedId={reviewData.reviewedId}
          reviewedName={reviewData.reviewedName}
          userType={reviewData.userType}
          onReviewSubmitted={() => {
            toast({
              title: "Review Submitted!",
              description: "Thank you for your feedback.",
            });
          }}
        />
      )}

      {/* Quick Booking Modal */}
      {showBookingModal && selectedTutor && (
        <QuickBookingModal
          isOpen={showBookingModal}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedTutor(null);
          }}
          tutor={selectedTutor}
          onSubmit={createBooking}
        />
      )}
    </div>
  );
};

export default LearnerApp;