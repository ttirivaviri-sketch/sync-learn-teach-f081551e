import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, startOfWeek, startOfMonth, subDays, format } from 'date-fns';
import { logger } from "@/utils/logger";

interface TutorStats {
  todayEarnings: number;
  todaySessions: number;
  todayHours: number;
  weekEarnings: number;
  monthEarnings: number;
  totalEarnings: number;
  totalHours: number;
  averageRating: number;
  totalReviews: number;
}

interface DailyEarning {
  name: string;
  earnings: number;
  sessions: number;
}

interface RecentEarning {
  id: string;
  student: string;
  subject: string;
  amount: number;
  date: string;
  rating: number | null;
}

export const useTutorStats = (userId?: string) => {
  const [stats, setStats] = useState<TutorStats>({
    todayEarnings: 0,
    todaySessions: 0,
    todayHours: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    totalEarnings: 0,
    totalHours: 0,
    averageRating: 0,
    totalReviews: 0,
  });
  const [weeklyData, setWeeklyData] = useState<DailyEarning[]>([]);
  const [recentEarnings, setRecentEarnings] = useState<RecentEarning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchStats = async () => {
      try {
        const now = new Date();
        const todayStart = startOfDay(now).toISOString();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
        const monthStart = startOfMonth(now).toISOString();

        // Fetch all completed bookings for this tutor
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            id,
            scheduled_at,
            duration_minutes,
            price,
            status,
            learner_profile:profiles!bookings_learner_id_fkey(full_name),
            tutor_subjects(subject)
          `)
          .eq('tutor_id', userId)
          .eq('status', 'completed')
          .order('scheduled_at', { ascending: false });

        if (bookingsError) {
          logger.error('Error fetching bookings:', bookingsError);
          return;
        }

        // Fetch reviews for this tutor
        const { data: reviews, error: reviewsError } = await supabase
          .from('reviews')
          .select('rating, booking_id')
          .eq('reviewed_id', userId);

        if (reviewsError) {
          logger.error('Error fetching reviews:', reviewsError);
        }

        // Calculate stats
        const completedBookings = bookings || [];
        
        // Today's stats
        const todayBookings = completedBookings.filter(
          b => new Date(b.scheduled_at) >= new Date(todayStart)
        );
        const todayEarnings = todayBookings.reduce((sum, b) => sum + Number(b.price), 0);
        const todaySessions = todayBookings.length;
        const todayHours = todayBookings.reduce((sum, b) => sum + b.duration_minutes / 60, 0);

        // Week stats
        const weekBookings = completedBookings.filter(
          b => new Date(b.scheduled_at) >= new Date(weekStart)
        );
        const weekEarnings = weekBookings.reduce((sum, b) => sum + Number(b.price), 0);

        // Month stats
        const monthBookings = completedBookings.filter(
          b => new Date(b.scheduled_at) >= new Date(monthStart)
        );
        const monthEarnings = monthBookings.reduce((sum, b) => sum + Number(b.price), 0);

        // Total stats
        const totalEarnings = completedBookings.reduce((sum, b) => sum + Number(b.price), 0);
        const totalHours = completedBookings.reduce((sum, b) => sum + b.duration_minutes / 60, 0);

        // Rating stats
        const reviewsData = reviews || [];
        const totalReviews = reviewsData.length;
        const averageRating = totalReviews > 0
          ? reviewsData.reduce((sum, r) => sum + r.rating, 0) / totalReviews
          : 0;

        setStats({
          todayEarnings,
          todaySessions,
          todayHours,
          weekEarnings,
          monthEarnings,
          totalEarnings,
          totalHours,
          averageRating: Math.round(averageRating * 10) / 10,
          totalReviews,
        });

        // Calculate weekly chart data (last 7 days)
        const last7Days: DailyEarning[] = [];
        for (let i = 6; i >= 0; i--) {
          const day = subDays(now, i);
          const dayStart = startOfDay(day);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);

          const dayBookings = completedBookings.filter(b => {
            const bookingDate = new Date(b.scheduled_at);
            return bookingDate >= dayStart && bookingDate < dayEnd;
          });

          last7Days.push({
            name: format(day, 'EEE'),
            earnings: dayBookings.reduce((sum, b) => sum + Number(b.price), 0),
            sessions: dayBookings.length,
          });
        }
        setWeeklyData(last7Days);

        // Get recent earnings (last 10 completed sessions)
        const recentBookings = completedBookings.slice(0, 10);
        const recentEarningsData: RecentEarning[] = recentBookings.map(booking => {
          const review = reviewsData.find(r => r.booking_id === booking.id);
          const scheduledDate = new Date(booking.scheduled_at);
          const diffDays = Math.floor((now.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60 * 24));
          
          let dateLabel = 'Today';
          if (diffDays === 1) dateLabel = 'Yesterday';
          else if (diffDays > 1) dateLabel = `${diffDays} days ago`;

          return {
            id: booking.id,
            student: booking.learner_profile?.full_name || 'Student',
            subject: booking.tutor_subjects?.subject || 'Session',
            amount: Number(booking.price),
            date: dateLabel,
            rating: review?.rating || null,
          };
        });
        setRecentEarnings(recentEarningsData);

      } catch (error) {
        logger.error('Error fetching tutor stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Set up real-time subscription for bookings updates
    const channel = supabase
      .channel('tutor-stats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `tutor_id=eq.${userId}`,
        },
        () => {
          fetchStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
          filter: `reviewed_id=eq.${userId}`,
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Format currency values
  const formattedStats = useMemo(() => ({
    todayEarnings: `R${stats.todayEarnings.toLocaleString()}`,
    weekEarnings: `R${stats.weekEarnings.toLocaleString()}`,
    monthEarnings: `R${stats.monthEarnings.toLocaleString()}`,
    totalEarnings: `R${stats.totalEarnings.toLocaleString()}`,
    todaySessions: stats.todaySessions,
    todayHours: Math.round(stats.todayHours * 10) / 10,
    totalHours: Math.round(stats.totalHours),
    averageRating: stats.averageRating,
    totalReviews: stats.totalReviews,
  }), [stats]);

  return {
    stats,
    formattedStats,
    weeklyData,
    recentEarnings,
    loading,
  };
};
