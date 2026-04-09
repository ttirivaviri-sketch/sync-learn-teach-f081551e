import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from "@/utils/logger";

interface TimeSlot {
  id?: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface DayAvailability {
  dayOfWeek: number;
  dayName: string;
  slots: TimeSlot[];
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const useTutorAvailability = (tutorId?: string) => {
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchAvailability = useCallback(async () => {
    if (!tutorId) return;

    try {
      const { data, error } = await supabase
        .from('tutor_availability')
        .select('*')
        .eq('tutor_id', tutorId)
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;

      // Transform data into day-based structure
      const dayMap = new Map<number, TimeSlot[]>();
      
      data?.forEach((slot) => {
        const existing = dayMap.get(slot.day_of_week) || [];
        existing.push({
          id: slot.id,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_available: slot.is_available,
        });
        dayMap.set(slot.day_of_week, existing);
      });

      const transformedAvailability: DayAvailability[] = DAYS_OF_WEEK.map(day => ({
        dayOfWeek: day.value,
        dayName: day.label,
        slots: dayMap.get(day.value) || [],
      }));

      setAvailability(transformedAvailability);
    } catch (error) {
      logger.error('Error fetching availability:', error);
      toast({
        title: 'Error',
        description: 'Failed to load availability schedule',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [tutorId, toast]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const addTimeSlot = async (dayOfWeek: number, startTime: string, endTime: string) => {
    if (!tutorId) return false;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tutor_availability')
        .insert({
          tutor_id: tutorId,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          is_available: true,
        });

      if (error) throw error;

      await fetchAvailability();
      toast({
        title: 'Time slot added',
        description: 'Your availability has been updated',
      });
      return true;
    } catch (error: any) {
      logger.error('Error adding time slot:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add time slot',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeTimeSlot = async (slotId: string) => {
    if (!tutorId) return false;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tutor_availability')
        .delete()
        .eq('id', slotId)
        .eq('tutor_id', tutorId);

      if (error) throw error;

      await fetchAvailability();
      toast({
        title: 'Time slot removed',
        description: 'Your availability has been updated',
      });
      return true;
    } catch (error) {
      logger.error('Error removing time slot:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove time slot',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleSlotAvailability = async (slotId: string, isAvailable: boolean) => {
    if (!tutorId) return false;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tutor_availability')
        .update({ is_available: isAvailable })
        .eq('id', slotId)
        .eq('tutor_id', tutorId);

      if (error) throw error;

      await fetchAvailability();
      return true;
    } catch (error) {
      logger.error('Error toggling availability:', error);
      toast({
        title: 'Error',
        description: 'Failed to update availability',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const setDefaultSchedule = async () => {
    if (!tutorId) return false;

    setSaving(true);
    try {
      // Default: Mon-Fri, 9am-5pm
      const defaultSlots = [1, 2, 3, 4, 5].map(day => ({
        tutor_id: tutorId,
        day_of_week: day,
        start_time: '09:00:00',
        end_time: '17:00:00',
        is_available: true,
      }));

      const { error } = await supabase
        .from('tutor_availability')
        .upsert(defaultSlots, { 
          onConflict: 'tutor_id,day_of_week,start_time,end_time' 
        });

      if (error) throw error;

      await fetchAvailability();
      toast({
        title: 'Default schedule set',
        description: 'Monday to Friday, 9 AM - 5 PM',
      });
      return true;
    } catch (error) {
      logger.error('Error setting default schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to set default schedule',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    availability,
    loading,
    saving,
    addTimeSlot,
    removeTimeSlot,
    toggleSlotAvailability,
    setDefaultSchedule,
    refreshAvailability: fetchAvailability,
  };
};
