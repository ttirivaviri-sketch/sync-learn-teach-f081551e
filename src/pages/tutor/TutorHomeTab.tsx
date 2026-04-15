/**
 * TutorHomeTab — Today's stats, quick actions, schedule, and onboarding checklist.
 */
import { useState, useEffect } from "react";
import {
  DollarSign, Clock, Users, Star, Bell, Settings, AlertTriangle,
  CheckCircle2, Circle, ChevronRight, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
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
  pendingCount: number;
  tutorName: string;
  mySubjects: Array<{ id: string; [key: string]: unknown }>;
  tutorId?: string;
  onNavigateTab: (tab: string) => void;
  onJoinSession?: (booking: BookingRequest) => void;
}

export const TutorHomeTab = ({
  todayStats,
  statsLoading,
  bookingsLoading,
  upcomingSessions,
  pendingCount,
  tutorName,
  mySubjects,
  tutorId,
  onNavigateTab,
  onJoinSession,
}: TutorHomeTabProps) => {
  // Onboarding checklist state
  const [hasAvailability, setHasAvailability] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<{ bio: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!tutorId || tutorId === "dev-tutor") return;

    const load = async () => {
      const [availRes, profileRes] = await Promise.all([
        supabase.from("tutor_availability").select("id").eq("tutor_id", tutorId).limit(1),
        supabase.from("profiles").select("bio, avatar_url").eq("id", tutorId).single(),
      ]);
      setHasAvailability((availRes.data?.length ?? 0) > 0);
      setProfile(profileRes.data ?? null);
    };
    load();
  }, [tutorId]);

  const hasSubjects = mySubjects.length > 0;
  const hasProfile = !!(profile?.bio && profile?.avatar_url);
  const checklistItems = [
    { done: hasSubjects, label: "Add your subjects", action: () => onNavigateTab("profile") },
    { done: hasAvailability === true, label: "Set your availability", action: () => onNavigateTab("activity") },
    { done: hasProfile, label: "Complete your profile (bio & photo)", action: () => onNavigateTab("profile") },
  ];
  const allDone = checklistItems.every(i => i.done);
  const showChecklist = hasAvailability !== null && !allDone;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold">{greeting}, {tutorName} 👋</h2>
        <p className="text-sm text-muted-foreground">Here's your overview for today</p>
      </div>

      {/* Pending Requests Alert */}
      {pendingCount > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-semibold">
                  {pendingCount} pending request{pendingCount > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground">Respond to secure sessions</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => onNavigateTab("activity")}>
              View <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Getting Started Checklist */}
      {showChecklist && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              🚀 Getting Started
              <Badge variant="secondary" className="text-[10px]">
                {checklistItems.filter(i => i.done).length}/{checklistItems.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {checklistItems.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full flex items-center gap-2 text-sm text-left hover:bg-primary/10 rounded-md p-1.5 transition-colors"
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.label}</span>
                {!item.done && <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

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
            upcomingSessions.slice(0, 3).map((booking) => {
              const now = Date.now();
              const startTime = new Date(booking.scheduled_at).getTime();
              const endTime = startTime + booking.duration_minutes * 60000;
              const isJoinable = booking.status === "confirmed" && now >= startTime - 15 * 60000 && now < endTime;

              return (
                <div key={booking.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <h4 className="font-medium">{booking.learner_profile?.full_name}</h4>
                    <p className="text-sm text-muted-foreground">{booking.tutor_subjects?.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(booking.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="font-semibold text-primary">R{booking.price}</p>
                      <p className="text-xs text-muted-foreground">{booking.duration_minutes} min</p>
                    </div>
                    {isJoinable && onJoinSession && (
                      <Button size="sm" className="h-8 gap-1" onClick={() => onJoinSession(booking)}>
                        <Video className="h-3.5 w-3.5" />
                        Join
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};
