import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Star, Clock, CreditCard, User, Video, ShoppingBag, LogOut, MessageCircle } from "lucide-react";
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

const LearnerApp = () => {
  const [activeTab, setActiveTab] = useState("search");
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
  const [videoMeetingData, setVideoMeetingData] = useState<any>(null);
  const [showLaunchScreen, setShowLaunchScreen] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [userLocation, setUserLocation] = useState("Johannesburg Central");
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
    // Simulate upcoming session - in real app this would come from database
    setUpcomingSession({
      tutor: "Sarah Johnson",
      subject: "Mathematics • Trigonometry",
      time: "Today, 3:00 PM",
      price: "R150/hour",
      sessionId: "session_123"
    });
  };

  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // In a real app, you'd reverse geocode this
          setUserLocation("Current Location");
          toast({
            title: "Location Updated",
            description: "Found tutors near you!",
          });
        },
        () => {
          // Keep default location if permission denied
          setUserLocation("Johannesburg Central");
        }
      );
    }
  };

  const nearbyTutors = [
    {
      id: 1,
      name: "Sarah Johnson",
      subject: "Mathematics",
      level: "Grade 10-12",
      rating: 4.8,
      reviews: 156,
      distance: "2.3 km",
      price: "R150/hour",
      avatar: "/placeholder.svg",
      available: true,
      onlineAvailable: true
    },
    {
      id: 2,
      name: "Michael Chen",
      subject: "Physics",
      level: "University",
      rating: 4.9,
      reviews: 203,
      distance: "1.8 km",
      price: "R200/hour",
      avatar: "/placeholder.svg",
      available: true,
      onlineAvailable: true
    },
    {
      id: 3,
      name: "Priya Patel",
      subject: "Chemistry",
      level: "Grade 11-12",
      rating: 4.7,
      reviews: 89,
      distance: "3.1 km",
      price: "R180/hour",
      avatar: "/placeholder.svg",
      available: false,
      onlineAvailable: true
    }
  ];

  const recentSessions = [
    {
      id: 1,
      tutor: "Sarah Johnson",
      subject: "Algebra",
      date: "Yesterday",
      duration: "2 hours",
      cost: "R300"
    },
    {
      id: 2,
      tutor: "David Wilson",
      subject: "Calculus",
      date: "3 days ago",
      duration: "1.5 hours",
      cost: "R225"
    }
  ];

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

  const handleBookInPerson = (tutor: any) => {
    if (!isOnline) {
      toast({
        title: "No connection",
        description: "Please check your internet connection to book sessions.",
        variant: "destructive",
      });
      return;
    }

    analytics.track('booking_initiated', { type: 'in-person', tutorId: tutor.id });
    setSelectedTutor(tutor);
    setShowBookingModal(true);
  };

  const handleBookOnline = (tutor: any) => {
    analytics.track('booking_initiated', { type: 'online', tutorId: tutor.id });
    setSelectedTutor(tutor);
    setShowBookingModal(true);
  };

  const handleSessionAction = (action: string) => {
    if (action === "join") {
      setVideoMeetingData({
        partnerName: upcomingSession?.tutor || "Tutor",
        subject: upcomingSession?.subject || "Study Session",
        booking: null
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
    setVideoMeetingData({
      partnerName: "Tutor", // In real app, get from booking data
      subject: booking.tutor_subjects?.subject || "Study Session",
      booking: booking
    });
    setShowVideoMeeting(true);
  };

  const handleRateAndReview = (session: any) => {
    setReviewData({
      bookingId: null, // Would be real booking ID in production
      reviewedId: 'tutor_id_here', // Would be actual tutor ID
      reviewedName: session.tutor,
      userType: 'learner'
    });
    setShowReviewModal(true);
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
      <header className="bg-primary text-primary-foreground p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">StudySync Learner</h1>
            <p className="text-sm opacity-90">Find your perfect tutor</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowChat(true)}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <div className="text-right">
              <p className="text-sm opacity-90 font-medium">{session?.user?.email}</p>
              {!isOnline && (
                <p className="text-xs text-red-200">Offline</p>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleSignOut}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <AdvancedBooking />

            {/* Quick Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Badge 
                variant={selectedSubject === "Mathematics" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedSubject(selectedSubject === "Mathematics" ? "" : "Mathematics")}
              >
                Mathematics
              </Badge>
              <Badge 
                variant={selectedSubject === "Physics" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedSubject(selectedSubject === "Physics" ? "" : "Physics")}
              >
                Physics
              </Badge>
              <Badge 
                variant={selectedSubject === "Chemistry" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedSubject(selectedSubject === "Chemistry" ? "" : "Chemistry")}
              >
                Chemistry
              </Badge>
              <Badge variant="outline">English</Badge>
              <Badge variant="outline">Grade 12</Badge>
            </div>

            {/* Location with refresh button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Tutors near {userLocation}</span>
              </div>
              <Button variant="outline" size="sm" onClick={requestLocation}>
                Update Location
              </Button>
            </div>

            {/* Available Tutors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Available Now</h3>
                <p className="text-sm text-muted-foreground">
                  {nearbyTutors.filter(tutor => 
                    (!searchQuery || tutor.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                     tutor.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                     tutor.level.toLowerCase().includes(searchQuery.toLowerCase())) &&
                    (!selectedSubject || tutor.subject === selectedSubject)
                  ).length} tutors found
                </p>
              </div>
              {nearbyTutors
                .filter(tutor => 
                  (!searchQuery || tutor.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                   tutor.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   tutor.level.toLowerCase().includes(searchQuery.toLowerCase())) &&
                  (!selectedSubject || tutor.subject === selectedSubject)
                )
                .map((tutor) => (
                <Card key={tutor.id} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar>
                        <AvatarImage src={tutor.avatar} />
                        <AvatarFallback>{tutor.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{tutor.name}</h4>
                            <p className="text-sm text-muted-foreground">{tutor.subject} • {tutor.level}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-primary">{tutor.price}</p>
                            <p className="text-xs text-muted-foreground">{tutor.distance}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 mt-2">
                          <StarRating rating={tutor.rating} readonly size="sm" />
                          <span className="text-sm font-medium">{tutor.rating}</span>
                          <span className="text-sm text-muted-foreground">({tutor.reviews})</span>
                          {tutor.available && (
                            <Badge variant="secondary" className="ml-2 text-xs">Available</Badge>
                          )}
                          {tutor.onlineAvailable && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              <Video className="h-3 w-3 mr-1" />
                              Online
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          <Button 
                            disabled={!tutor.available}
                            variant={tutor.available ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => handleBookInPerson(tutor)}
                          >
                            {tutor.available ? "Book In-Person" : "Unavailable"}
                          </Button>
                          {tutor.onlineAvailable && (
                            <Button 
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleBookOnline(tutor)}
                            >
                              <Video className="h-4 w-4 mr-1" />
                              Book Online
                            </Button>
                          )}
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
              ))}
            </div>
          </TabsContent>

          <TabsContent value="bookings" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Your Bookings</h3>
              <Badge variant="outline">{bookings.length} total</Badge>
            </div>
            
            {bookingsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-muted-foreground">Loading bookings...</p>
              </div>
            ) : bookings.length === 0 ? (
              <EmptyState
                title="No bookings yet"
                description="Start by searching for tutors and booking your first session!"
                action={{
                  label: "Browse Tutors",
                  onClick: () => setActiveTab("search")
                }}
              />
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <LiveBookingCard
                    key={booking.id}
                    booking={booking}
                    userType="learner"
                    onJoinSession={handleJoinVideoSession}
                    onStartChat={(booking) => {
                      setChatWithUserId(booking.tutor_id);
                      setChatWithUserName("Tutor");
                      setShowChat(true);
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="library" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">StudySync Library</h3>
            </div>
            <StudySyncLibrary />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <h3 className="font-semibold">Recent Sessions</h3>
            
            {recentSessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{session.tutor}</h4>
                      <p className="text-sm text-muted-foreground">{session.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">{session.date} • {session.duration}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{session.cost}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => handleRateAndReview(session)}
                      >
                        Rate & Review
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src="/placeholder.svg" />
                    <AvatarFallback>
                      {profile?.full_name ? 
                        profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 
                        session?.user?.email?.charAt(0).toUpperCase() || 'U'
                      }
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">
                      {profile?.full_name || session?.user?.email?.split('@')[0] || 'Learner'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {profile?.user_type === 'learner' ? 'Student' : 'User'} • {userLocation}
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

                {/* Profile Stats */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-lg font-semibold">12</p>
                    <p className="text-xs text-muted-foreground">Sessions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">4.8</p>
                    <p className="text-xs text-muted-foreground">Rating</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">R2,350</p>
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
                    onClick={() => setActiveTab("history")}
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

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setActiveTab("search")}
                >
                  Find New Tutor
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setActiveTab("store")}
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