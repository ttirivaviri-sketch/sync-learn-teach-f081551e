import { useState, useEffect } from "react";
import { Clock, Calendar, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
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
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatTime = (time: string) => {
  const [hours] = time.split(':');
  const hour = parseInt(hours);
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
};

const TutorAvailabilityDisplay = ({ 
  tutorId, 
  onSelectSlot,
  selectedDate,
  selectedTime 
}: TutorAvailabilityDisplayProps) => {
  const [availability, setAvailability] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Generate next 7 days starting from today
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

  const getSlotsForDay = (dayOfWeek: number) => {
    return availability.filter(slot => slot.day_of_week === dayOfWeek);
  };

  const isDayAvailable = (date: Date) => {
    const dayOfWeek = date.getDay();
    return getSlotsForDay(dayOfWeek).length > 0;
  };

  const handleDayClick = (date: Date) => {
    if (isDayAvailable(date)) {
      setSelectedDay(date);
    }
  };

  const handleSlotClick = (date: Date, slot: TimeSlot) => {
    if (onSelectSlot) {
      onSelectSlot(date, slot.start_time, slot.end_time);
    }
  };

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
              <span className="text-xs font-medium">
                {DAYS_OF_WEEK[date.getDay()]}
              </span>
              <span className="text-lg font-bold">
                {format(date, 'd')}
              </span>
              {isToday && (
                <span className="text-[10px]">Today</span>
              )}
              {isAvailable && !isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Time slots for selected day */}
      {selectedDay && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-primary" />
            Available Times for {format(selectedDay, 'EEEE, MMM d')}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {getSlotsForDay(selectedDay.getDay()).map((slot) => {
              const isSlotSelected = selectedDate && 
                isSameDay(selectedDate, selectedDay) && 
                selectedTime === slot.start_time;

              return (
                <Button
                  key={slot.id}
                  variant={isSlotSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSlotClick(selectedDay, slot)}
                  className="gap-2"
                >
                  {isSlotSelected && <Check className="h-3 w-3" />}
                  {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                </Button>
              );
            })}
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
                {day}: {slots.map(s => `${formatTime(s.start_time)}-${formatTime(s.end_time)}`).join(', ')}
              </Badge>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TutorAvailabilityDisplay;
