/**
 * LearnerHomeTab — Search, subject filters, location, tutor cards.
 */
import { useState } from "react";
import { MapPin, Video, MessageCircle, Search, Award, CalendarCheck, Clock, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SchoolWorkspaceBanner } from "@/components/school/SchoolWorkspaceBanner";
import { SmartSuggestionStrip } from "@/components/learner/SmartSuggestionStrip";
import { NextActionCard } from "@/components/learner/NextActionCard";
import { MasteryIntelligenceCard } from "@/components/learner/MasteryIntelligenceCard";
import { WeeklyDigestCard } from "@/components/learner/WeeklyDigestCard";
import { haptic } from "@/lib/haptics";

import StarRating from "@/components/StarRating";
import { EmptyState } from "@/components/EmptyState";
import type { TutorProfile } from "@/hooks/useTutorData";

// ── Skeleton card ───────────────────────────────────────────────────────────
const TutorCardSkeleton = () => (
  <Card className="shadow-sm">
    <CardContent className="p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-24" />
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

// ── Props ───────────────────────────────────────────────────────────────────
interface LearnerHomeTabProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  allSubjects: string[];
  selectedSubject: string;
  onSelectSubject: (s: string) => void;
  userGeoLocation: { lat: number; lng: number } | null;
  locationLoading: boolean;
  onUpdateLocation: () => void;
  tutors: TutorProfile[];
  tutorsLoading: boolean;
  onRefreshTutors: () => void;
  onBookTutor: (tutor: TutorProfile) => void;
  onStartChat: (tutor: { id: string | number; full_name?: string; name?: string }) => void;
  isUserOnline: (userId: string) => boolean;
  upcomingBookings?: any[];
  needsPayment?: (id: string) => boolean;
  onJoinVideoSession?: (booking: any) => void;
  onPayNow?: (booking: any) => void;
  onStartCheckout?: (booking: any) => void;
}

// ── Component ───────────────────────────────────────────────────────────────
export const LearnerHomeTab = ({
  searchQuery,
  onSearchChange,
  allSubjects,
  selectedSubject,
  onSelectSubject,
  userGeoLocation,
  locationLoading,
  onUpdateLocation,
  tutors,
  tutorsLoading,
  onRefreshTutors,
  onBookTutor,
  onStartChat,
  isUserOnline,
  upcomingBookings = [],
  needsPayment,
  onJoinVideoSession,
  onPayNow,
  onStartCheckout,
}: LearnerHomeTabProps) => {
  const [lessonsOpen, setLessonsOpen] = useState(false);
  const upcomingCount = upcomingBookings.length;

  const isJoinable = (booking: any) => {
    if (booking.status !== "confirmed") return false;
    if (needsPayment?.(booking.id)) return false;
    const start = new Date(booking.scheduled_at).getTime();
    const now = Date.now();
    return now >= start - 15 * 60 * 1000 && now <= start + booking.duration_minutes * 60 * 1000;
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" }) +
      " · " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  };

  const hasImminentLesson = upcomingBookings.some((b) => {
    if (b.status !== "confirmed") return false;
    const start = new Date(b.scheduled_at).getTime();
    return start - Date.now() < 15 * 60 * 1000 && start - Date.now() > -60 * 60 * 1000;
  });

  return (
  <div className="space-y-4 p-4 mt-0">
    {/* Hero: single "do this now" card — the one obvious primary action */}
    <NextActionCard />

    {/* Compact action strip — My Lessons + At-a-glance toggle */}
    <div className="flex gap-2 items-stretch">
      <Button
        onClick={() => { haptic("light"); setLessonsOpen(true); }}
        variant="outline"
        className="flex-1 h-10 justify-between px-3 border-primary/30 hover:bg-primary/5"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <CalendarCheck className="h-4 w-4 text-primary" />
          My Lessons
        </span>
        {upcomingCount > 0 && (
          <Badge
            variant="default"
            className={`ml-2 h-5 px-1.5 text-[10px] ${hasImminentLesson ? "animate-pulse" : ""}`}
          >
            {upcomingCount}
          </Badge>
        )}
      </Button>
    </div>

    {/* At-a-glance — insight cards collapsed into one expandable strip */}
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 transition-colors text-left group">
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            At a glance — progress, digest & suggestions
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        <SchoolWorkspaceBanner />
        <MasteryIntelligenceCard />
        <WeeklyDigestCard />
        <SmartSuggestionStrip
          onSuggest={(topic) => {
            onSearchChange(topic);
          }}
        />
      </CollapsibleContent>
    </Collapsible>

    {/* Lessons Bottom Sheet */}
    <Sheet open={lessonsOpen} onOpenChange={setLessonsOpen}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-3">
          <SheetTitle>My Upcoming Lessons</SheetTitle>
        </SheetHeader>

        {upcomingBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CalendarCheck className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-foreground">No confirmed lessons</p>
            <p className="text-sm text-muted-foreground mt-1">Paid and confirmed sessions will appear here</p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {upcomingBookings.map((booking) => {
              const tutorName = (booking.tutor_profile as any)?.full_name || "Tutor";
              const subject = (booking.tutor_subjects as any)?.subject || "Session";
              const avatarUrl = (booking.tutor_profile as any)?.avatar_url;
              const initials = tutorName.split(" ").map((n: string) => n[0]).join("").slice(0, 2);
              const joinable = isJoinable(booking);

              return (
                <Card key={booking.id} className="border-l-4 border-l-primary shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={avatarUrl || "/placeholder.svg"} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{tutorName}</p>
                            <p className="text-xs text-muted-foreground">{subject}</p>
                          </div>
                          <Badge variant={booking.status === "confirmed" ? "default" : "outline"} className="text-[10px] shrink-0">
                            {booking.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDateTime(booking.scheduled_at)}</span>
                          <span className="ml-1">({booking.duration_minutes}min)</span>
                        </div>
                        <div className="flex gap-2 mt-2">
                          {joinable ? (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 text-xs flex-1"
                              onClick={() => { onJoinVideoSession?.(booking); setLessonsOpen(false); }}
                            >
                              <Video className="h-3 w-3 mr-1" />
                              Join
                            </Button>
                          ) : booking.status === "requested" ? (
                            <Button size="sm" variant="outline" className="h-8 text-xs flex-1" disabled>
                              <Clock className="h-3 w-3 mr-1" />
                              Awaiting Tutor
                            </Button>
                          ) : needsPayment?.(booking.id) ? (
                            <Button
                              size="sm"
                              className="h-8 text-xs flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                              onClick={() => { onPayNow?.(booking); setLessonsOpen(false); }}
                            >
                              Pay to Join
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-8 text-xs flex-1" disabled>
                              <Clock className="h-3 w-3 mr-1" />
                              Upcoming
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs"
                            onClick={() => {
                              onStartChat?.({ id: booking.tutor_id, full_name: tutorName });
                              setLessonsOpen(false);
                            }}
                          >
                            <MessageCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>

    

    

    {/* Search Bar */}
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search by subject or tutor name..." className="pl-9" />
    </div>

    {/* Quick Subject Filters */}
    <div className="flex gap-2 overflow-x-auto pb-2">
      {allSubjects.map((subject) => (
        <Badge key={subject} variant={selectedSubject === subject ? "default" : "outline"} className="cursor-pointer whitespace-nowrap active:scale-95 transition-transform" onClick={() => { haptic("selection"); onSelectSubject(selectedSubject === subject ? "" : subject); }}>
          {subject}
        </Badge>
      ))}
      {allSubjects.length === 0 && !tutorsLoading && <p className="text-sm text-muted-foreground">No subjects available yet</p>}
    </div>

    {/* Location */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4" />
        <span>Tutors near {userGeoLocation ? "your location" : "Johannesburg Central"}{locationLoading && " (updating...)"}</span>
      </div>
      <Button variant="outline" size="sm" onClick={onUpdateLocation} disabled={locationLoading}>
        {locationLoading ? "Updating..." : "Update Location"}
      </Button>
    </div>

    {/* Available Tutors */}
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{selectedSubject ? `${selectedSubject} Tutors` : "Available Tutors"}</h3>
        {!tutorsLoading && <p className="text-sm text-muted-foreground">{tutors.length} found</p>}
      </div>

      {tutorsLoading ? (
        <div className="space-y-3">
          <TutorCardSkeleton />
          <TutorCardSkeleton />
          <TutorCardSkeleton />
        </div>
      ) : tutors.length === 0 ? (
        <EmptyState
          title={selectedSubject ? `No ${selectedSubject} tutors found` : "No tutors available"}
          description={selectedSubject ? "Try a different subject or clear your filter" : "No tutors with subjects are currently registered. Check back soon!"}
          action={{ label: "Refresh List", onClick: onRefreshTutors }}
        />
      ) : (
        tutors.map((tutor) => {
          const online = isUserOnline(tutor.id);
          return (
            <Card key={tutor.id} className="shadow-sm animate-fade-in transition-all hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarImage src={tutor.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback>{tutor.full_name?.split(" ").map((n) => n[0]).join("") || "T"}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{tutor.full_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {tutor.subjects.map((s) => s.subject).join(", ")} • {tutor.subjects[0]?.level}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">R{tutor.subjects[0]?.hourly_rate}/hour</p>
                        <p className="text-xs text-muted-foreground">{tutor.distance}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <StarRating rating={tutor.rating} readonly size="sm" />
                      <span className="text-sm font-medium">{tutor.rating > 0 ? tutor.rating : "New"}</span>
                      {tutor.totalReviews > 0 && <span className="text-sm text-muted-foreground">({tutor.totalReviews})</span>}
                      {online && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                          Online now
                        </Badge>
                      )}
                    </div>

                    {/* Qualifications */}
                    {tutor.qualifications && tutor.qualifications.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tutor.qualifications.slice(0, 3).map((q) => (
                          <Badge key={q.id} variant="outline" className="text-xs">
                            <Award className="h-3 w-3 mr-1" />
                            {q.qualification_type}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <Button variant="outline" className="flex-1 active:scale-95 transition-transform" onClick={() => { haptic("light"); onBookTutor(tutor); }}>
                        <MapPin className="h-3 w-3 mr-1" />
                        In-Person
                      </Button>
                      <Button variant="default" className="flex-1 active:scale-95 transition-transform" onClick={() => { haptic("light"); onBookTutor(tutor); }}>
                        <Video className="h-4 w-4 mr-1" />
                        Book Online
                      </Button>
                      <Button variant="secondary" className="flex-1 active:scale-95 transition-transform" onClick={() => { haptic("selection"); onStartChat(tutor); }}>
                        <MessageCircle className="h-4 w-4 mr-1" />
                        Chat
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  </div>
  );
};
