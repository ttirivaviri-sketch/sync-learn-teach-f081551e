import { Video, MapPin, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import TutorAvailabilityDisplay from "@/components/TutorAvailabilityDisplay";
import { TutorProfile } from "@/hooks/useTutorData";
import { format } from "date-fns";

interface BookingFormPanelProps {
  tutor: TutorProfile;
  selectedSubjectId: string;
  sessionType: "online" | "in-person";
  duration: string;
  notes: string;
  selectedDate: Date | null;
  selectedTime: string;
  selectedEndTime: string;
  isBooking: boolean;
  userId?: string;
  onSubjectChange: (id: string) => void;
  onSessionTypeChange: (type: "online" | "in-person") => void;
  onDurationChange: (d: string) => void;
  onNotesChange: (n: string) => void;
  onSlotSelect: (date: Date, start: string, end: string) => void;
  onBook: () => void;
}

function formatTimeLabel(time: string) {
  const [hours] = time.split(":");
  const hour = parseInt(hours);
  if (hour === 0) return "12:00 AM";
  if (hour === 12) return "12:00 PM";
  if (hour > 12) return `${hour - 12}:00 PM`;
  return `${hour}:00 AM`;
}

export function BookingFormPanel({
  tutor,
  selectedSubjectId,
  sessionType,
  duration,
  notes,
  selectedDate,
  selectedTime,
  selectedEndTime,
  isBooking,
  userId,
  onSubjectChange,
  onSessionTypeChange,
  onDurationChange,
  onNotesChange,
  onSlotSelect,
  onBook,
}: BookingFormPanelProps) {
  const selectedSubject = tutor.subjects.find((s) => s.id === selectedSubjectId);
  const price = selectedSubject ? selectedSubject.hourly_rate * (parseInt(duration) / 60) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Book with {tutor.full_name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Subject</label>
            <Select value={selectedSubjectId} onValueChange={onSubjectChange}>
              <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>
                {tutor.subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.subject} ({subject.level}) - R{subject.hourly_rate}/hr
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Session Type</label>
            <Select value={sessionType} onValueChange={(v) => onSessionTypeChange(v as "online" | "in-person")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="online"><div className="flex items-center gap-2"><Video className="w-4 h-4" />Online</div></SelectItem>
                <SelectItem value="in-person"><div className="flex items-center gap-2"><MapPin className="w-4 h-4" />In-person</div></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Duration</label>
            <Select value={duration} onValueChange={onDurationChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="90">1.5 hours</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-muted/30">
          <TutorAvailabilityDisplay
            tutorId={tutor.id}
            onSelectSlot={onSlotSelect}
            selectedDate={selectedDate || undefined}
            selectedTime={selectedTime}
            durationMinutes={parseInt(duration)}
          />
        </div>

        {selectedDate && selectedTime && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <Calendar className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-sm">{format(selectedDate, "EEEE, MMMM d, yyyy")}</p>
              <p className="text-sm text-muted-foreground">
                {formatTimeLabel(selectedTime)} - {formatTimeLabel(selectedEndTime)}
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
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </div>

        <Button
          onClick={onBook}
          className="w-full"
          size="lg"
          disabled={!selectedSubjectId || !selectedDate || !selectedTime || isBooking || !userId}
        >
          {isBooking ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating booking...</>
          ) : !userId ? (
            "Sign in to book"
          ) : !selectedDate || !selectedTime ? (
            "Select a time slot to continue"
          ) : (
            `Book Session - R${price.toFixed(0)}`
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
