import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, Clock, Users, Settings, Bell, Calendar, MapPin, Star, Video, LogOut, MessageCircle, BarChart3, User, History, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import VideoMeeting from "@/components/VideoMeeting";
import DirectionsMap from "@/components/DirectionsMap";
import ChatInterface from "@/components/ChatInterface";
import StarRating from "@/components/StarRating";
import TutorEarningsChart from "@/components/TutorEarningsChart";
import TutorProfile from "@/components/TutorProfile";
import SessionHistory from "@/components/SessionHistory";

const TutorApp = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isOnline, setIsOnline] = useState(true);
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
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

  const todayStats = {
    earnings: "R450",
    sessions: 3,
    hours: 4.5,
    rating: 4.8
  };

  const incomingRequests = [
    {
      id: 1,
      student: "John Doe",
      subject: "Mathematics",
      topic: "Quadratic Equations",
      level: "Grade 11",
      date: "Today",
      time: "4:00 PM",
      duration: "1 hour",
      rate: "R150/hour",
      distance: "2.1 km",
      address: "123 Main Street, Sandton, Johannesburg",
      type: "online"
    },
    {
      id: 2,
      student: "Sarah Wilson",
      subject: "Physics",
      topic: "Thermodynamics",
      level: "University",
      date: "Tomorrow",
      time: "2:00 PM",
      duration: "2 hours",
      rate: "R200/hour",
      distance: "1.8 km",
      address: "456 Oak Avenue, Rosebank, Johannesburg",
      type: "in-person"
    }
  ];

  const upcomingSessions = [
    {
      id: 1,
      student: "Emily Chen",
      subject: "Chemistry",
      time: "3:00 PM - 4:00 PM",
      location: "Sandton City",
      earnings: "R180",
      type: "in-person"
    },
    {
      id: 2,
      student: "Michael Brown",
      subject: "Mathematics",
      time: "5:00 PM - 6:30 PM",
      location: "Online Session",
      earnings: "R225",
      type: "online"
    }
  ];

  const handleAcceptRequest = (request: any) => {
    toast({
      title: "Request Accepted!",
      description: `Starting session with ${request.student}`,
    });
    
    if (request.type === "online") {
      setShowVideoMeeting(true);
    } else {
      setSelectedRequest(request);
      setShowDirections(true);
    }
  };

  const handleDeclineRequest = (request: any) => {
    toast({
      title: "Request Declined",
      description: `Declined session with ${request.student}`,
    });
  };

  const handleOnlineToggle = (checked: boolean) => {
    setIsOnline(checked);
    toast({
      title: checked ? "Now Online" : "Now Offline",
      description: checked ? "You're available for bookings" : "You won't receive new booking requests",
    });
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

  if (showVideoMeeting) {
    return (
      <VideoMeeting
        sessionType="tutor"
        partnerName="John Doe"
        subject="Mathematics"
        onEndCall={() => setShowVideoMeeting(false)}
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
        </div>
      )}

      {/* Main Content */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
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

            {/* Today's Schedule */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <h4 className="font-medium">{session.student}</h4>
                      <p className="text-sm text-muted-foreground">{session.subject}</p>
                      <p className="text-xs text-muted-foreground">{session.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">{session.earnings}</p>
                      <p className="text-xs text-muted-foreground">{session.location}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Booking Requests</h3>
              <Badge variant="secondary">{incomingRequests.length} new</Badge>
            </div>
            
            {incomingRequests.map((request) => (
              <Card key={request.id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{request.student}</h4>
                        <p className="text-sm text-muted-foreground">
                          {request.subject} • {request.topic}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">{request.level}</p>
                          <Badge variant={request.type === "online" ? "secondary" : "outline"} className="text-xs">
                            {request.type === "online" ? (
                              <>
                                <Video className="h-3 w-3 mr-1" />
                                Online
                              </>
                            ) : (
                              "In-Person"
                            )}
                          </Badge>
                        </div>
                      </div>
                      <Badge variant="outline">{request.rate}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{request.date}, {request.time}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{request.duration}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{request.type === "online" ? "Online" : `${request.distance} away`}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        <span>Est. {request.rate.split('/')[0]}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1" 
                        size="sm"
                        onClick={() => handleAcceptRequest(request)}
                      >
                        Accept
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1" 
                        size="sm"
                        onClick={() => handleDeclineRequest(request)}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>This Week</CardTitle>
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
          </TabsContent>

          <TabsContent value="earnings" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-2xl font-bold text-primary">R2,450</p>
                  <p className="text-sm text-muted-foreground">This Week</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <DollarSign className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <p className="text-2xl font-bold text-green-600">R9,680</p>
                  <p className="text-sm text-muted-foreground">This Month</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <BarChart3 className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                  <p className="text-2xl font-bold text-blue-600">R35,240</p>
                  <p className="text-sm text-muted-foreground">Total Earned</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <Clock className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                  <p className="text-2xl font-bold text-purple-600">156h</p>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                </CardContent>
              </Card>
            </div>

            <TutorEarningsChart 
              data={[
                { name: "Mon", earnings: 350, sessions: 2 },
                { name: "Tue", earnings: 450, sessions: 3 },
                { name: "Wed", earnings: 300, sessions: 2 },
                { name: "Thu", earnings: 600, sessions: 4 },
                { name: "Fri", earnings: 400, sessions: 3 },
                { name: "Sat", earnings: 550, sessions: 4 },
                { name: "Sun", earnings: 200, sessions: 1 }
              ]}
            />
            
            <Card>
              <CardHeader>
                <CardTitle>Recent Earnings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { student: "John Doe", subject: "Mathematics", amount: "R150", date: "Today", rating: 5 },
                  { student: "Sarah Wilson", subject: "Physics", amount: "R200", date: "Yesterday", rating: 4 },
                  { student: "Mike Brown", subject: "Chemistry", amount: "R180", date: "2 days ago", rating: 5 }
                ].map((earning, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <h4 className="font-medium">{earning.student}</h4>
                      <p className="text-sm text-muted-foreground">{earning.subject}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <StarRating rating={earning.rating} readonly size="sm" />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">{earning.amount}</p>
                      <p className="text-xs text-muted-foreground">{earning.date}</p>
                    </div>
                  </div>
                ))}
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
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <TutorProfile user={session?.user} />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <SessionHistory userType="tutor" userId={session?.user?.id || ""} />
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