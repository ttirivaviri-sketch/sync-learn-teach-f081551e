import { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, DollarSign, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

interface QuickBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tutor: {
    id: string;
    name: string;
    subject: string;
    level: string;
    price: number;
    subjectId: string;
    avatar?: string;
  };
  onSubmit: (bookingData: {
    tutor_id: string;
    tutor_subject_id: string;
    scheduled_at: string;
    duration_minutes: number;
    price: number;
  }) => Promise<any>;
}

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const QuickBookingModal = ({ isOpen, onClose, tutor, onSubmit }: QuickBookingModalProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [notes, setNotes] = useState('');
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const { toast } = useToast();

  // Fetch tutor availability when modal opens
  useEffect(() => {
    if (!isOpen || !tutor.id) return;
    setLoadingAvailability(true);
    supabase
      .from('tutor_availability')
      .select('day_of_week, start_time, end_time, is_available')
      .eq('tutor_id', tutor.id)
      .eq('is_available', true)
      .then(({ data }) => {
        setAvailability((data as AvailabilitySlot[]) || []);
        setLoadingAvailability(false);
      });
  }, [isOpen, tutor.id]);

  // Generate next 14 days
  const availableDates = useMemo(() => {
    const dates: { value: string; label: string; dayOfWeek: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push({
        value: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        dayOfWeek: date.getDay(),
      });
    }
    return dates;
  }, []);

  // Filter dates to only those where the tutor has availability
  const datesWithAvailability = useMemo(() => {
    if (availability.length === 0) return availableDates; // Show all if no availability data
    const availableDays = new Set(availability.map(a => a.day_of_week));
    return availableDates.filter(d => availableDays.has(d.dayOfWeek));
  }, [availableDates, availability]);

  // Generate time slots based on tutor's availability for the selected date
  const timeSlots = useMemo(() => {
    const selectedDateObj = availableDates.find(d => d.value === selectedDate);
    if (!selectedDateObj) return [];

    const daySlots = availability.filter(
      a => a.day_of_week === selectedDateObj.dayOfWeek && a.is_available
    );

    if (daySlots.length === 0) {
      // No availability data — show generic slots
      const slots: string[] = [];
      for (let hour = 8; hour <= 20; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
        }
      }
      return slots;
    }

    // Generate 30-min slots within each availability window
    const slots: string[] = [];
    for (const slot of daySlots) {
      const [startH, startM] = slot.start_time.split(':').map(Number);
      const [endH, endM] = slot.end_time.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      for (let m = startMinutes; m < endMinutes; m += 30) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  }, [selectedDate, availability, availableDates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate || !selectedTime) {
      toast({
        title: "Missing Information",
        description: "Please select both date and time for your session.",
        variant: "destructive",
      });
      return;
    }

    if (!tutor.subjectId) {
      toast({
        title: "Invalid Tutor Data",
        description: "This tutor's subject information is missing. Please try another tutor.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const scheduledAt = new Date(`${selectedDate}T${selectedTime}`);

      await onSubmit({
        tutor_id: tutor.id,
        tutor_subject_id: tutor.subjectId,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: parseInt(duration),
        price: tutor.price,
      });

      toast({
        title: "Booking Request Sent!",
        description: `Your session request has been sent to ${tutor.name}. You'll be prompted to pay once confirmed.`,
      });

      onClose();

      setSelectedDate('');
      setSelectedTime('');
      setDuration('60');
      setNotes('');
    } catch (error) {
      logger.error('Booking error:', error);
      toast({
        title: "Booking Failed",
        description: "There was an error sending your booking request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book Session with {tutor.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Session Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{tutor.subject}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{tutor.level}</span>
              </div>
              <div className="flex items-center gap-1 text-primary font-semibold">
                <DollarSign className="h-4 w-4" />
                R{tutor.price}/hour
              </div>
              {availability.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Showing tutor's available time slots</span>
                </div>
              )}
            </CardContent>
          </Card>

          {loadingAvailability ? (
            <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
              Loading availability...
            </div>
          ) : (
            <div className="space-y-3">
              {datesWithAvailability.length === 0 && (
                <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    This tutor hasn't set availability yet. You can still request a session — they'll confirm if available.
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="date">Date</Label>
                <select
                  id="date"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(''); }}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Select date</option>
                  {(datesWithAvailability.length > 0 ? datesWithAvailability : availableDates).map(date => (
                    <option key={date.value} value={date.value}>
                      {date.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="time">Time</Label>
                <select
                  id="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  disabled={!selectedDate}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                >
                  <option value="">{selectedDate ? "Select time" : "Select a date first"}</option>
                  {timeSlots.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>


              <div>
                <Label htmlFor="duration">Duration</Label>
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

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any specific topics or requirements..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || loadingAvailability} className="flex-1">
              {loading ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
