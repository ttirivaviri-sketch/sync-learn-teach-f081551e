import { useState, useEffect } from "react";
import { Clock, User, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTutorData, TutorProfile } from "@/hooks/useTutorData";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { logger } from "@/utils/logger";
import { TutorBrowseCard } from "./advanced-booking/TutorBrowseCard";
import { BookingFormPanel } from "./advanced-booking/BookingFormPanel";

export const AdvancedBooking = () => {
  const [selectedTutor, setSelectedTutor] = useState<TutorProfile | null>(null);
  const [sessionType, setSessionType] = useState<"online" | "in-person">("online");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedEndTime, setSelectedEndTime] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const { toast } = useToast();

  const { location } = useGeolocation();
  const { tutors, loading, refreshTutors } = useTutorData(location);
  const { createBooking } = useRealtimeBookings("learner", userId);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getUser();
  }, []);

  const availableTutors = tutors.filter((t) => t.subjects && t.subjects.length > 0);

  const handleTutorSelect = (tutor: TutorProfile) => {
    setSelectedTutor(tutor);
    setSelectedDate(null);
    setSelectedTime("");
    setSelectedEndTime("");
    if (tutor.subjects?.length > 0) setSelectedSubjectId(tutor.subjects[0].id);
  };

  const handleSlotSelect = (date: Date, startTime: string, endTime: string) => {
    setSelectedDate(date);
    setSelectedTime(startTime);
    setSelectedEndTime(endTime);
  };

  const formatTimeLabel = (time: string) => {
    const [hours] = time.split(":");
    const hour = parseInt(hours);
    if (hour === 0) return "12:00 AM";
    if (hour === 12) return "12:00 PM";
    if (hour > 12) return `${hour - 12}:00 PM`;
    return `${hour}:00 AM`;
  };

  const handleBookSession = async () => {
    if (!userId) { toast({ title: "Please sign in", description: "You need to be logged in to book a session", variant: "destructive" }); return; }
    if (!selectedTutor) { toast({ title: "Select a tutor", description: "Please choose a tutor before booking", variant: "destructive" }); return; }
    if (!selectedSubjectId) { toast({ title: "Select a subject", description: "Please choose a subject for your session", variant: "destructive" }); return; }
    if (!selectedDate || !selectedTime) { toast({ title: "Select a time", description: "Please choose when you'd like to have your session", variant: "destructive" }); return; }

    const subject = selectedTutor.subjects.find((s) => s.id === selectedSubjectId);
    const price = subject ? subject.hourly_rate * (parseInt(duration) / 60) : 0;
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    setIsBooking(true);
    try {
      await createBooking({
        tutor_id: selectedTutor.id,
        tutor_subject_id: selectedSubjectId,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: parseInt(duration),
        price,
      });
      toast({
        title: "Session booked!",
        description: `Your session with ${selectedTutor.full_name} on ${format(selectedDate, "EEE, MMM d")} at ${formatTimeLabel(selectedTime)} has been requested.`,
      });
      setSelectedTutor(null);
      setSelectedSubjectId("");
      setSelectedDate(null);
      setSelectedTime("");
      setSelectedEndTime("");
      setNotes("");
    } catch (error) {
      logger.error("Booking error:", error);
      toast({ title: "Booking failed", description: error instanceof Error ? error.message : "Could not create booking. Please try again.", variant: "destructive" });
    } finally {
      setIsBooking(false);
    }
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
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={refreshTutors} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {loading && availableTutors.length === 0 && (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i}><CardContent className="p-6"><div className="flex items-start gap-4"><Skeleton className="w-16 h-16 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-60" /><Skeleton className="h-4 w-32" /></div></div></CardContent></Card>
              ))}
            </div>
          )}

          {!loading && availableTutors.length === 0 && (
            <Card><CardContent className="p-8 text-center"><User className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><h3 className="font-semibold text-lg mb-2">No tutors available</h3><p className="text-muted-foreground mb-4">No tutors with subjects are currently registered. Check back soon!</p><Button variant="outline" onClick={refreshTutors}><RefreshCw className="w-4 h-4 mr-2" />Refresh List</Button></CardContent></Card>
          )}

          <div className="grid gap-4">
            {availableTutors.map((tutor) => (
              <TutorBrowseCard key={tutor.id} tutor={tutor} isSelected={selectedTutor?.id === tutor.id} onSelect={() => handleTutorSelect(tutor)} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="instant" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" />Quick Match</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Get matched with an available tutor in under 5 minutes</p>
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  const online = availableTutors.filter((t) => t.online_status);
                  if (online.length > 0) {
                    handleTutorSelect(online[0]);
                    toast({ title: "Match found!", description: `You've been matched with ${online[0].full_name}` });
                  } else {
                    toast({ title: "No tutors online", description: "No tutors are currently available. Please try again later.", variant: "destructive" });
                  }
                }}
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Finding tutors...</>
                ) : (
                  `Find Available Tutor Now (${availableTutors.filter((t) => t.online_status).length} online)`
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedTutor && (
        <BookingFormPanel
          tutor={selectedTutor}
          selectedSubjectId={selectedSubjectId}
          sessionType={sessionType}
          duration={duration}
          notes={notes}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          selectedEndTime={selectedEndTime}
          isBooking={isBooking}
          userId={userId}
          onSubjectChange={setSelectedSubjectId}
          onSessionTypeChange={setSessionType}
          onDurationChange={setDuration}
          onNotesChange={setNotes}
          onSlotSelect={handleSlotSelect}
          onBook={handleBookSession}
        />
      )}
    </div>
  );
};
