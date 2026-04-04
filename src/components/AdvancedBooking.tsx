import { useState, useEffect } from "react";
import { Clock, MapPin, Video, DollarSign, User, Loader2, RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTutorData, TutorProfile } from "@/hooks/useTutorData";
import { useGeolocation } from "@/hooks/useGeolocation";
import { OnlineStatus } from "@/components/OnlineStatus";
import TutorAvailabilityDisplay from "@/components/TutorAvailabilityDisplay";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const AdvancedBooking = () => {
  const [selectedTutor, setSelectedTutor] = useState<TutorProfile | null>(null);
  const [sessionType, setSessionType] = useState<"online" | "in-person">("online");
  const [duration, setDuration] = useState<string>("60");
  const [notes, setNotes] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedEndTime, setSelectedEndTime] = useState<string>("");
  const [isBooking, setIsBooking] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const { toast } = useToast();

  // Use real data hooks
  const { location } = useGeolocation();
  const { tutors, loading, refreshTutors } = useTutorData(location);
  const { createBooking } = useRealtimeBookings('learner', userId);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getUser();
  }, []);

  // Filter tutors who have at least one subject
  const availableTutors = tutors.filter(tutor => tutor.subjects && tutor.subjects.length > 0);

  const handleBookSession = async () => {
    if (!userId) {
      toast({
        title: "Please sign in",
        description: "You need to be logged in to book a session",
        variant: "destructive"
      });
      return;
    }

    if (!selectedTutor) {
      toast({
        title: "Select a tutor",
        description: "Please choose a tutor before booking",
        variant: "destructive"
      });
      return;
    }

    if (!selectedSubjectId) {
      toast({
        title: "Select a subject",
        description: "Please choose a subject for your session",
        variant: "destructive"
      });
      return;
    }

    if (!selectedDate || !selectedTime) {
      toast({
        title: "Select a time",
        description: "Please choose when you'd like to have your session",
        variant: "destructive"
      });
      return;
    }

    const selectedSubject = selectedTutor.subjects.find(s => s.id === selectedSubjectId);
    const price = selectedSubject ? selectedSubject.hourly_rate * (parseInt(duration) / 60) : 0;

    // Combine date and time into scheduled_at timestamp
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    setIsBooking(true);
    try {
      await createBooking({
        tutor_id: selectedTutor.id,
        tutor_subject_id: selectedSubjectId,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: parseInt(duration),
        price: price,
      });

      toast({
        title: "Session booked!",
        description: `Your session with ${selectedTutor.full_name} on ${format(selectedDate, 'EEE, MMM d')} at ${formatTime(selectedTime)} has been requested. You'll be prompted to pay once the tutor confirms.`,
      });

      // Reset form
      setSelectedTutor(null);
      setSelectedSubjectId("");
      setSelectedDate(null);
      setSelectedTime("");
      setSelectedEndTime("");
      setNotes("");
    } catch (error) {
      console.error('Booking error:', error);
      toast({
        title: "Booking failed",
        description: error instanceof Error ? error.message : "Could not create booking. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsBooking(false);
    }
  };

  const handleTutorSelect = (tutor: TutorProfile) => {
    setSelectedTutor(tutor);
    setSelectedDate(null);
    setSelectedTime("");
    setSelectedEndTime("");
    // Auto-select first subject if available
    if (tutor.subjects && tutor.subjects.length > 0) {
      setSelectedSubjectId(tutor.subjects[0].id);
    }
  };

  const handleSlotSelect = (date: Date, startTime: string, endTime: string) => {
    setSelectedDate(date);
    setSelectedTime(startTime);
    setSelectedEndTime(endTime);
  };

  const getSelectedSubjectPrice = () => {
    if (!selectedTutor || !selectedSubjectId) return 0;
    const subject = selectedTutor.subjects.find(s => s.id === selectedSubjectId);
    return subject ? subject.hourly_rate * (parseInt(duration) / 60) : 0;
  };

  const formatTime = (time: string) => {
    const [hours] = time.split(':');
    const hour = parseInt(hours);
    if (hour === 0) return '12:00 AM';
    if (hour === 12) return '12:00 PM';
    if (hour > 12) return `${hour - 12}:00 PM`;
    return `${hour}:00 AM`;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Book Your Next Session</h2>
        <p className="text-muted-foreground">Choose from our verified expert tutors</p>
      </div>

      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="browse">Browse Tutors</TabsTrigger>
          <TabsTrigger value="instant">Instant Match</TabsTrigger>
        </TabsList>
        
        <TabsContent value="browse" className="space-y-4">
          {/* Refresh button */}
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshTutors}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Loading state */}
          {loading && availableTutors.length === 0 && (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Skeleton className="w-16 h-16 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-60" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && availableTutors.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No tutors available</h3>
                <p className="text-muted-foreground mb-4">
                  No tutors with subjects are currently registered. Check back soon!
                </p>
                <Button variant="outline" onClick={refreshTutors}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh List
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tutor list */}
          <div className="grid gap-4">
            {availableTutors.map((tutor) => (
              <Card 
                key={tutor.id} 
                className={`cursor-pointer transition-all ${
                  selectedTutor?.id === tutor.id 
                    ? "ring-2 ring-primary border-primary" 
                    : "hover:shadow-card"
                }`}
                onClick={() => handleTutorSelect(tutor)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={tutor.avatar_url || undefined} alt={tutor.full_name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {tutor.full_name?.charAt(0) || 'T'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-foreground">{tutor.full_name}</h3>
                        <OnlineStatus isOnline={tutor.online_status} lastSeen={tutor.last_seen} />
                        <Badge variant="secondary">{tutor.rating || 4.8} ⭐</Badge>
                      </div>
                      
                      {/* Subjects */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {tutor.subjects.map((subject) => (
                          <Badge key={subject.id} variant="outline" className="text-xs">
                            {subject.subject} • {subject.level}
                          </Badge>
                        ))}
                      </div>

                      {tutor.bio && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{tutor.bio}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <DollarSign className="w-4 h-4" />
                          R{tutor.subjects[0]?.hourly_rate || 0}/hour
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          {tutor.distance || 'Location unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="instant" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Quick Match
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Get matched with an available tutor in under 5 minutes
              </p>
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => {
                  const onlineTutors = availableTutors.filter(t => t.online_status);
                  if (onlineTutors.length > 0) {
                    handleTutorSelect(onlineTutors[0]);
                    toast({
                      title: "Match found!",
                      description: `You've been matched with ${onlineTutors[0].full_name}`,
                    });
                  } else {
                    toast({
                      title: "No tutors online",
                      description: "No tutors are currently available. Please try again later.",
                      variant: "destructive"
                    });
                  }
                }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finding tutors...
                  </>
                ) : (
                  `Find Available Tutor Now (${availableTutors.filter(t => t.online_status).length} online)`
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedTutor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Book with {selectedTutor.full_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Subject selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedTutor.subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.subject} ({subject.level}) - R{subject.hourly_rate}/hr
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Session Type</label>
                <Select value={sessionType} onValueChange={(value: "online" | "in-person") => setSessionType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        Online
                      </div>
                    </SelectItem>
                    <SelectItem value="in-person">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        In-person
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Duration</label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Availability Display */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <TutorAvailabilityDisplay
                tutorId={selectedTutor.id}
                onSelectSlot={handleSlotSelect}
                selectedDate={selectedDate || undefined}
                selectedTime={selectedTime}
              />
            </div>

            {/* Selected time confirmation */}
            {selectedDate && selectedTime && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Calendar className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(selectedTime)} - {formatTime(selectedEndTime)}
                  </p>
                </div>
                <Badge variant="secondary">Selected</Badge>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium mb-2 block">Special requests or topics</label>
              <Textarea 
                placeholder="What would you like to focus on in this session?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={handleBookSession} 
              className="w-full" 
              size="lg"
              disabled={!selectedSubjectId || !selectedDate || !selectedTime || isBooking || !userId}
            >
              {isBooking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating booking...
                </>
              ) : !userId ? (
                "Sign in to book"
              ) : !selectedDate || !selectedTime ? (
                "Select a time slot to continue"
              ) : (
                `Book Session - R${getSelectedSubjectPrice().toFixed(0)}`
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
