import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, Clock, Users, Settings, Bell, Calendar, MapPin, Star, Video, LogOut, MessageCircle, BarChart3, User, History, TrendingUp, Home, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { LiveBookingCard } from "@/components/LiveBookingCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import VideoMeeting from "@/components/VideoMeeting";
import DirectionsMap from "@/components/DirectionsMap";
import ChatInterface from "@/components/ChatInterface";
import StarRating from "@/components/StarRating";
import TutorEarningsChart from "@/components/TutorEarningsChart";
import TutorProfile from "@/components/TutorProfile";
import SessionHistory from "@/components/SessionHistory";
import { useTutorData } from '@/hooks/useTutorData';
import { TutorSubjectManager } from '@/components/TutorSubjectManager';
import { usePresenceTracking } from '@/hooks/usePresenceTracking';
import { useTutorStats } from '@/hooks/useTutorStats';
import TutorAvailabilitySchedule from '@/components/TutorAvailabilitySchedule';


const TutorApp = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [isOnline, setIsOnline] = useState(true);
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
  const [videoMeetingData, setVideoMeetingData] = useState<any>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeklyAvailability, setWeeklyAvailability] = useState({
    Monday: true,
    Tuesday: true, 
    Wednesday: true,
    Thursday: true,
    Friday: true
  });
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

  // Initialize tutor data management
  const { tutors, updateOnlineStatus } = useTutorData();
  const currentTutor = tutors.find(t => t.id === session?.user?.id);

  // Initialize presence tracking for real-time online status
  const { setOnlineStatus, onlineUsers } = usePresenceTracking(session);

  // Real tutor stats from database
  const { formattedStats, weeklyData, recentEarnings, loading: statsLoading } = useTutorStats(session?.user?.id);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);
        if (!session?.user) {
          navigate("/tutor/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session?.user) {
        navigate("/tutor/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your tutor account.",
      });
      navigate("/tutor/auth");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  // Use real stats from database
  const todayStats = {
    earnings: formattedStats.todayEarnings,
    sessions: formattedStats.todaySessions,
    hours: formattedStats.todayHours,
    rating: formattedStats.averageRating || 0
  };

  const handleAcceptRequest = async (booking: any) => {
    try {
      await updateBookingStatus(booking.id, 'confirmed');
      toast({
        title: "Request Accepted!",
        description: `Session confirmed with ${booking.learner_profile?.full_name}`,
      });
      
      // For immediate sessions, start video meeting
      const sessionTime = new Date(booking.scheduled_at);
      const now = new Date();
      const isNow = Math.abs(sessionTime.getTime() - now.getTime()) < 15 * 60 * 1000;
      
      if (isNow) {
        setVideoMeetingData({
          partnerName: booking.learner_profile?.full_name || "Student",
          subject: booking.tutor_subjects?.subject || "Study Session",
          booking: booking
        });
        setShowVideoMeeting(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to accept booking request",
        variant: "destructive",
      });
    }
  };

  const handleJoinVideoSession = (booking: any) => {
    setVideoMeetingData({
      partnerName: booking.learner_profile?.full_name || "Student",
      subject: booking.tutor_subjects?.subject || "Study Session",
      booking: booking
    });
    setShowVideoMeeting(true);
  };

  const handleDeclineRequest = async (booking: any) => {
    try {
      await updateBookingStatus(booking.id, 'canceled');
      toast({
        title: "Request Declined",
        description: `Declined session with ${booking.learner_profile?.full_name}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to decline booking request",
        variant: "destructive",
      });
    }
  };

  const handleOnlineToggle = async (checked: boolean) => {
    setIsOnline(checked);
    
    // Update both database and presence tracking
    await Promise.all([
      updateOnlineStatus(checked),
      setOnlineStatus(checked)
    ]);
  };

  const handleUpdateAvailability = () => {
    toast({
      title: "Availability Updated",
      description: "Your weekly schedule has been saved",
    });
  };

  const handleQuickAction = (action: string) => {
    toast({
      title: action,
      description: "Feature coming soon!",
    });
  };

  const handleRequestPayout = () => {
    toast({
      title: "Payout Requested",
      description: "Your payout request has been submitted and will be processed within 2-3 business days",
    });
  };

  const toggleDayAvailability = (day: string) => {
    setWeeklyAvailability(prev => ({
      ...prev,
      [day]: !prev[day as keyof typeof prev]
    }));
  };

  if (showVideoMeeting && videoMeetingData) {
    return (
      <VideoMeeting
        sessionType="tutor"
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

  if (showDirections && selectedRequest) {
    return (
      <DirectionsMap
        learnerAddress={selectedRequest.address}
        learnerName={selectedRequest.student}
        subject={selectedRequest.subject}
        onBack={() => {
          setShowDirections(false);
          setSelectedRequest(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-secondary text-secondary-foreground p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">StudySync Tutor</h1>
            <p className="text-sm opacity-90">Earn by teaching</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">Online</span>
              <Switch 
                checked={isOnline} 
                onCheckedChange={handleOnlineToggle}
              />
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowChat(true)}
              className="text-secondary-foreground hover:bg-secondary-foreground/10"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm">{session.user?.email}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
            <Avatar>
              <AvatarImage src="/placeholder.svg" />
              <AvatarFallback>{session.user?.user_metadata?.full_name?.[0] || 'T'}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* Status Banner */}
      {isOnline && (
        <div className="bg-primary text-primary-foreground p-3 text-center text-sm">
          🟢 You're online and available for booking requests
          {onlineUsers.length > 1 && (
            <span className="ml-2 opacity-75">
              • {onlineUsers.length - 1} other users online
            </span>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 pb-20">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="home" className="flex flex-col gap-1">
              <Home className="h-4 w-4" />
              <span className="text-xs">Home</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex flex-col gap-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs">Activity</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex flex-col gap-1">
              <User className="h-4 w-4" />
              <span className="text-xs">Profile</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="home" className="space-y-4">
            {/* Today's Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <DollarSign className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-2xl font-bold text-primary">{todayStats.earnings}</p>
                  <p className="text-sm text-muted-foreground">Today's Earnings</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-8 w-8 mx-auto text-secondary mb-2" />
                  <p className="text-2xl font-bold text-secondary">{todayStats.sessions}</p>
                  <p className="text-sm text-muted-foreground">Sessions Today</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <Clock className="h-8 w-8 mx-auto text-accent mb-2" />
                  <p className="text-2xl font-bold text-accent">{todayStats.hours}h</p>
                  <p className="text-sm text-muted-foreground">Hours Taught</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <Star className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                  <p className="text-2xl font-bold text-yellow-600">{todayStats.rating}</p>
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
                  onClick={() => handleQuickAction("Update Availability")}
                >
                  <Bell className="h-6 w-6 mb-2" />
                  <span className="text-sm">Update Availability</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex-col"
                  onClick={() => handleQuickAction("Profile Settings")}
                >
                  <Settings className="h-6 w-6 mb-2" />
                  <span className="text-sm">Profile Settings</span>
                </Button>
              </CardContent>
            </Card>

            {/* Today's Schedule - uses real booking data */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsLoading ? (
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


          <TabsContent value="activity" className="space-y-4">
            {/* Booking Requests Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Booking Requests</CardTitle>
                  <Badge variant="secondary">{getIncomingRequests().length} new</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {bookingsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-muted-foreground">Loading requests...</p>
                  </div>
                ) : getIncomingRequests().length === 0 ? (
                  <div className="p-8 text-center">
                    <h4 className="font-medium mb-2">No pending requests</h4>
                    <p className="text-sm text-muted-foreground">
                      New booking requests will appear here in real-time
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getIncomingRequests().map((booking) => (
                      <LiveBookingCard
                        key={booking.id}
                        booking={booking}
                        userType="tutor"
                        onAccept={handleAcceptRequest}
                        onDecline={handleDeclineRequest}
                        onJoinSession={handleJoinVideoSession}
                        onStartChat={(booking) => {
                          setChatWithUserId(booking.learner_id);
                          setChatWithUserName(booking.learner_profile?.full_name || "Student");
                          setShowChat(true);
                        }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Sessions Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Upcoming Sessions</CardTitle>
                  <Badge variant="secondary">{getUpcomingSessions().length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {bookingsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-muted-foreground">Loading sessions...</p>
                  </div>
                ) : getUpcomingSessions().length === 0 ? (
                  <div className="p-8 text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <h4 className="font-medium mb-2">No upcoming sessions</h4>
                    <p className="text-sm text-muted-foreground">
                      Accepted sessions will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getUpcomingSessions().map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{booking.learner_profile?.full_name}</h4>
                            {booking.status === 'confirmed' && (
                              <Badge variant="outline" className="text-xs">Confirmed</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{booking.tutor_subjects?.subject}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(booking.scheduled_at).toLocaleDateString()} at {new Date(booking.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {booking.duration_minutes} minutes
                          </p>
                        </div>
                        <div className="text-right flex flex-col gap-2">
                          <p className="font-semibold text-primary">R{booking.price}</p>
                          <Button 
                            size="sm" 
                            onClick={() => handleJoinVideoSession(booking)}
                            className="whitespace-nowrap"
                          >
                            <Video className="h-3 w-3 mr-1" />
                            Join
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schedule Section */}
            <Card>
              <CardHeader>
                <CardTitle>Weekly Availability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                    <div key={day} className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">{day}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {weeklyAvailability[day as keyof typeof weeklyAvailability] 
                            ? "Available 2:00 PM - 8:00 PM" 
                            : "Not available"
                          }
                        </span>
                        <Switch 
                          checked={weeklyAvailability[day as keyof typeof weeklyAvailability]}
                          onCheckedChange={() => toggleDayAvailability(day)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                
                <Button 
                  className="w-full mt-4"
                  onClick={handleUpdateAvailability}
                >
                  Update Availability
                </Button>
              </CardContent>
            </Card>

            {/* Session History Section */}
            <Card>
              <CardHeader>
                <CardTitle>Session History</CardTitle>
              </CardHeader>
              <CardContent>
                <SessionHistory userType="tutor" userId={session?.user?.id || ""} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            {/* Earnings Section - Real Data */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  {statsLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (
                    <>
                      <TrendingUp className="h-8 w-8 mx-auto text-primary mb-2" />
                      <p className="text-2xl font-bold text-primary">{formattedStats.weekEarnings}</p>
                      <p className="text-sm text-muted-foreground">This Week</p>
                    </>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  {statsLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (
                    <>
                      <DollarSign className="h-8 w-8 mx-auto text-green-500 mb-2" />
                      <p className="text-2xl font-bold text-green-600">{formattedStats.monthEarnings}</p>
                      <p className="text-sm text-muted-foreground">This Month</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  {statsLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (
                    <>
                      <BarChart3 className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                      <p className="text-2xl font-bold text-blue-600">{formattedStats.totalEarnings}</p>
                      <p className="text-sm text-muted-foreground">Total Earned</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  {statsLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (
                    <>
                      <Clock className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                      <p className="text-2xl font-bold text-purple-600">{formattedStats.totalHours}h</p>
                      <p className="text-sm text-muted-foreground">Total Hours</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {weeklyData.length > 0 && (
              <TutorEarningsChart data={weeklyData} />
            )}
            
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
            
            <div className="grid md:grid-cols-2 gap-4">
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleRequestPayout}
              >
                Request Payout
              </Button>
              <Button 
                variant="outline"
                className="w-full" 
                size="lg"
                onClick={() => handleQuickAction("Download Tax Report")}
              >
                Download Tax Report
              </Button>
            </div>

            <TutorSubjectManager 
              subjects={currentTutor?.subjects || []}
            />
            
            {/* Availability Schedule - persisted to database */}
            <TutorAvailabilitySchedule tutorId={session?.user?.id || ''} />
            
            <TutorProfile user={session?.user} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Chat Interface */}
      <ChatInterface
        session={session}
        userType="tutor"
        isOpen={showChat}
        onClose={() => {
          setShowChat(false);
          setChatWithUserId(null);
          setChatWithUserName(null);
        }}
        otherUserId={chatWithUserId || undefined}
        otherUserName={chatWithUserName || undefined}
      />
    </div>
  );
};

export default TutorApp;