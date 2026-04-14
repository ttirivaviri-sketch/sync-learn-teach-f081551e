import { useState } from "react";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookingRequest } from "@/hooks/useRealtimeBookings";
import { format, addDays, setHours, setMinutes } from "date-fns";

interface RescheduleDialogProps {
  booking: BookingRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReschedule: (bookingId: string, newScheduledAt: string, reason?: string) => Promise<void>;
}

const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", 
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"
];

export const RescheduleDialog = ({ 
  booking, 
  open, 
  onOpenChange, 
  onReschedule 
}: RescheduleDialogProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate next 7 days for selection
  const availableDates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i + 1));

  const handleSubmit = async () => {
    if (!booking || !selectedDate || !selectedTime) return;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const newScheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

    setIsSubmitting(true);
    try {
      await onReschedule(booking.id, newScheduledAt.toISOString(), reason);
      onOpenChange(false);
      resetForm();
    } catch (err) {
      // Error already handled by parent via toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedDate(null);
    setSelectedTime("");
    setReason("");
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reschedule Session
          </DialogTitle>
          <DialogDescription>
            Propose a new time for the session with {booking.learner_profile?.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current booking info */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">Current Schedule</p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(booking.scheduled_at), "EEEE, MMMM d 'at' h:mm a")}
            </p>
            <Badge variant="outline" className="mt-2">
              {booking.tutor_subjects?.subject} • {booking.duration_minutes} min
            </Badge>
          </div>

          {/* Date selection */}
          <div className="space-y-2">
            <Label>Select New Date</Label>
            <div className="grid grid-cols-4 gap-2">
              {availableDates.map((date) => (
                <Button
                  key={date.toISOString()}
                  type="button"
                  variant={selectedDate?.toDateString() === date.toDateString() ? "default" : "outline"}
                  className="flex flex-col h-auto py-2 px-2"
                  onClick={() => setSelectedDate(date)}
                >
                  <span className="text-xs">{format(date, "EEE")}</span>
                  <span className="text-sm font-medium">{format(date, "d")}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Time selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Select New Time
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {TIME_SLOTS.map((time) => (
                <Button
                  key={time}
                  type="button"
                  variant={selectedTime === time ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTime(time)}
                >
                  {time}
                </Button>
              ))}
            </div>
          </div>

          {/* Reason for reschedule */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Let the learner know why you need to reschedule..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          {/* Preview new time */}
          {selectedDate && selectedTime && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm font-medium text-primary">New Proposed Time</p>
              <p className="text-sm">
                {format(selectedDate, "EEEE, MMMM d")} at {selectedTime}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedDate || !selectedTime || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Propose New Time"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
