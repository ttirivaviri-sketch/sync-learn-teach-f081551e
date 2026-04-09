/**
 * TutorHomeTab — Today's stats, quick actions, and schedule.
 */
import {
  DollarSign, Clock, Users, Star, Bell, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookingRequest } from "@/hooks/useRealtimeBookings";

interface TodayStats {
  earnings: string;
  sessions: number;
  hours: number;
  rating: number;
}

interface TutorHomeTabProps {
  todayStats: TodayStats;
  statsLoading: boolean;
  bookingsLoading: boolean;
  upcomingSessions: BookingRequest[];
  onNavigateTab: (tab: string) => void;
}

export const TutorHomeTab = ({
  todayStats,
  statsLoading,
  bookingsLoading,
  upcomingSessions,
  onNavigateTab,
}: TutorHomeTabProps) => (
  <div className="space-y-4">
    {/* Today's Stats */}
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-4 text-center">
          <DollarSign className="h-8 w-8 mx-auto text-primary mb-2" />
          {statsLoading ? <Skeleton className="h-8 w-20 mx-auto" /> : (
            <p className="text-2xl font-bold text-primary">{todayStats.earnings}</p>
          )}
          <p className="text-sm text-muted-foreground">Today's Earnings</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-center">
          <Users className="h-8 w-8 mx-auto text-secondary mb-2" />
          {statsLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (
            <p className="text-2xl font-bold text-secondary">{todayStats.sessions}</p>
          )}
          <p className="text-sm text-muted-foreground">Sessions Today</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-center">
          <Clock className="h-8 w-8 mx-auto text-accent mb-2" />
          {statsLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (
            <p className="text-2xl font-bold text-accent">{todayStats.hours}h</p>
          )}
          <p className="text-sm text-muted-foreground">Hours Taught</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-center">
          <Star className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
          {statsLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (
            <p className="text-2xl font-bold text-yellow-600">{todayStats.rating}</p>
          )}
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
        <Button variant="outline" className="h-auto p-4 flex-col" onClick={() => onNavigateTab("activity")}>
          <Bell className="h-6 w-6 mb-2" />
          <span className="text-sm">Update Availability</span>
        </Button>
        <Button variant="outline" className="h-auto p-4 flex-col" onClick={() => onNavigateTab("profile")}>
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
        {bookingsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : upcomingSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No sessions scheduled for today
          </p>
        ) : (
          upcomingSessions.slice(0, 3).map((booking) => (
            <div key={booking.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <h4 className="font-medium">{booking.learner_profile?.full_name}</h4>
                <p className="text-sm text-muted-foreground">{booking.tutor_subjects?.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(booking.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-primary">R{booking.price}</p>
                <p className="text-xs text-muted-foreground">{booking.duration_minutes} min</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  </div>
);
