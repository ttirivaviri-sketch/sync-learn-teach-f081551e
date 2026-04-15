import { useState, useEffect, useMemo } from "react";
import { Clock, Calendar, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isSameDay } from "date-fns";
import { logger } from "@/utils/logger";

interface TimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface TutorAvailabilityDisplayProps {
  tutorId: string;
  onSelectSlot?: (date: Date, startTime: string, endTime: string) => void;
  selectedDate?: Date;
  selectedTime?: string;
  durationMinutes?: number;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatTime12 = (time: string) => {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const min = m || '00';
  if (hour === 0) return `12:${min} AM`;
  if (hour === 12) return `12:${min} PM`;
  if (hour > 12) return `${hour - 12}:${min} PM`;
  return `${hour}:${min} AM`;
};

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

const minutesToTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const TutorAvailabilityDisplay = ({
  tutorId,
  onSelectSlot,
  selectedDate,
  selectedTime,
  durationMinutes = 60,
}: TutorAvailabilityDisplayProps) => {
  const [availability, setAvailability] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<string>("");
  const [selectedMinute, setSelectedMinute] = useState<string>("");

  const today = new Date();
  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  useEffect(() => {
    const fetchAvailability = async () => {
      if (!tutorId) return;
      try {
        const { data, error } = await supabase
          .from('tutor_availability')
          .select('*')
          .eq('tutor_id', tutorId)
          .eq('is_available', true)
          .order('day_of_week')
          .order('start_time');
        if (error) throw error;
        setAvailability(data || []);
      } catch (error) {
        logger.error('Error fetching availability:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAvailability();
  }, [tutorId]);

  const getSlotsForDay = (dayOfWeek: number) =>
    availability.filter(slot => slot.day_of_week === dayOfWeek);

  const isDayAvailable = (date: Date) =>
    getSlotsForDay(date.getDay()).length > 0;

  const handleDayClick = (date: Date) => {
    if (isDayAvailable(date)) {
      setSelectedDay(date);
      setSelectedHour("");
      setSelectedMinute("");
    }
  };

  // Get available windows for selected day
  const daySlots = selectedDay ? getSlotsForDay(selectedDay.getDay()) : [];

  // Build valid hours from available windows
  const validHours = useMemo(() => {
    const hours = new Set<number>();
    daySlots.forEach(slot => {
      const startMin = timeToMinutes(slot.start_time);
      const endMin = timeToMinutes(slot.end_time);
      for (let m = startMin; m + durationMinutes <= endMin; m += 5) {
        hours.add(Math.floor(m / 60));
      }
    });
    return Array.from(hours).sort((a, b) => a - b);
  }, [daySlots, durationMinutes]);

  // Build valid minutes for the selected hour
  const validMinutes = useMemo(() => {
    if (!selectedHour) return [];
    const h = parseInt(selectedHour);
    const mins = new Set<number>();
    daySlots.forEach(slot => {
      const startMin = timeToMinutes(slot.start_time);
      const endMin = timeToMinutes(slot.end_time);
      for (let minute = 0; minute < 60; minute += 5) {
        const total = h * 60 + minute;
        if (total >= startMin && total + durationMinutes <= endMin) {
          mins.add(minute);
        }
      }
    });
    return Array.from(mins).sort((a, b) => a - b);
  }, [selectedHour, daySlots, durationMinutes]);

  // When both hour and minute are selected, fire onSelectSlot
  useEffect(() => {
    if (selectedDay && selectedHour && selectedMinute && onSelectSlot) {
      const startTime = `${selectedHour.padStart(2, '0')}:${selectedMinute.padStart(2, '0')}`;
      const endMins = timeToMinutes(startTime) + durationMinutes;
      const endTime = minutesToTime(endMins);
      onSelectSlot(selectedDay, startTime, endTime);
    }
  }, [selectedDay, selectedHour, selectedMinute, durationMinutes]);

  // "Now" button handler
  const handleNow = () => {
    if (!selectedDay || !isSameDay(selectedDay, today)) return;
    const now = new Date();
    // Round up to next 5-min
    const currentMins = now.getHours() * 60 + Math.ceil(now.getMinutes() / 5) * 5;
    const fits = daySlots.some(slot => {
      const startMin = timeToMinutes(slot.start_time);
      const endMin = timeToMinutes(slot.end_time);
      return currentMins >= startMin && currentMins + durationMinutes <= endMin;
    });
    if (fits) {
      const h = Math.floor(currentMins / 60);
      const m = currentMins % 60;
      setSelectedHour(h.toString());
      setSelectedMinute(m.toString());
    }
  };

  const isNowAvailable = useMemo(() => {
    if (!selectedDay || !isSameDay(selectedDay, today)) return false;
    const now = new Date();
    const currentMins = now.getHours() * 60 + Math.ceil(now.getMinutes() / 5) * 5;
    return daySlots.some(slot => {
      const startMin = timeToMinutes(slot.start_time);
      const endMin = timeToMinutes(slot.end_time);
      return currentMins >= startMin && currentMins + durationMinutes <= endMin;
    });
  }, [selectedDay, today, daySlots, durationMinutes]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <Skeleton key={i} className="h-16 w-12" />
          ))}
        </div>
      </div>
    );
  }

  if (availability.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-muted text-center">
        <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          This tutor hasn't set their availability yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Calendar className="h-4 w-4 text-primary" />
        Select a Day
      </div>

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {next7Days.map((date) => {
          const isAvailable = isDayAvailable(date);
          const isSelected = selectedDay && isSameDay(date, selectedDay);
          const isToday = isSameDay(date, today);

          return (
            <button
              key={date.toISOString()}
              onClick={() => handleDayClick(date)}
              disabled={!isAvailable}
              className={`
                flex flex-col items-center min-w-[56px] p-2 rounded-lg border transition-all
                ${isSelected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : isAvailable
                    ? 'bg-card hover:bg-accent border-border cursor-pointer'
                    : 'bg-muted text-muted-foreground border-transparent cursor-not-allowed opacity-50'
                }
              `}
            >
              <span className="text-xs font-medium">{DAYS_OF_WEEK[date.getDay()]}</span>
              <span className="text-lg font-bold">{format(date, 'd')}</span>
              {isToday && <span className="text-[10px]">Today</span>}
              {isAvailable && !isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Time picker for selected day */}
      {selectedDay && (
        <div className="space-y-3">
          {/* Available windows */}
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-primary" />
            Pick a Time for {format(selectedDay, 'EEEE, MMM d')}
          </div>

          <div className="flex flex-wrap gap-1 mb-2">
            {daySlots.map(slot => (
              <Badge key={slot.id} variant="secondary" className="text-xs">
                {formatTime12(slot.start_time)} – {formatTime12(slot.end_time)}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedHour} onValueChange={(v) => { setSelectedHour(v); setSelectedMinute(""); }}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Hour" />
              </SelectTrigger>
              <SelectContent>
                {validHours.map(h => (
                  <SelectItem key={h} value={h.toString()}>
                    {h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground font-bold">:</span>

            <Select value={selectedMinute} onValueChange={setSelectedMinute} disabled={!selectedHour}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="Min" />
              </SelectTrigger>
              <SelectContent>
                {validMinutes.map(m => (
                  <SelectItem key={m} value={m.toString()}>
                    {m.toString().padStart(2, '0')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isNowAvailable && (
              <Button variant="outline" size="sm" onClick={handleNow} className="gap-1">
                <Zap className="h-3 w-3" /> Now
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Weekly availability summary */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground mb-2">Weekly Schedule</p>
        <div className="flex flex-wrap gap-1">
          {DAYS_OF_WEEK.map((day, index) => {
            const slots = getSlotsForDay(index);
            if (slots.length === 0) return null;
            return (
              <Badge key={day} variant="secondary" className="text-xs">
                {day}: {slots.map(s => `${formatTime12(s.start_time)}-${formatTime12(s.end_time)}`).join(', ')}
              </Badge>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TutorAvailabilityDisplay;
