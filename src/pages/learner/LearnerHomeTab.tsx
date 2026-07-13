/**
 * LearnerHomeTab — matches UI spec page 3 mockup exactly:
 *   greeting → gradient streak hero → TODAY agenda → CONTINUE LEARNING rings
 *   → "Find a tutor" teaser (expands to the full marketplace).
 * Bookings live in Activity (single booking truth) — no "My Lessons" here.
 * No duplicate "at a glance"/next-action blocks — Today framing lives here once.
 */
import { useState } from "react";
import { MapPin, Video, MessageCircle, Search, Award, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeTodayHero } from "@/components/learner/HomeTodayHero";
import { HomeContinueLearning } from "@/components/learner/HomeContinueLearning";
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
  displayName?: string | null;
  onNavigateTab?: (tab: string) => void;
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
  displayName,
  onNavigateTab,
}: LearnerHomeTabProps) => {
  // "Find a tutor" teaser (mockup) — expands to the full marketplace below.
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);

  const teaserTutors = tutors.slice(0, 3);
  const teaserRates = tutors
    .map((t) => Number(t.subjects[0]?.hourly_rate))
    .filter((r) => Number.isFinite(r) && r > 0);
  const fromRate = teaserRates.length ? Math.min(...teaserRates) : null;
  const teaserSubject = selectedSubject || tutors[0]?.subjects[0]?.subject || "All subjects";

  return (
  <div className="space-y-5 p-4 mt-0">
    {/* Greeting → gradient streak hero → TODAY agenda */}
    <HomeTodayHero
      displayName={displayName}
      upcomingBookings={upcomingBookings}
      onOpenStudy={() => onNavigateTab?.("study")}
      onOpenActivity={() => onNavigateTab?.("activity")}
    />

    {/* CONTINUE LEARNING — per-subject mastery rings → Study */}
    <HomeContinueLearning onOpenStudy={() => onNavigateTab?.("study")} />

    {/* Find-a-tutor teaser — avatar stack + from-price, expands the marketplace */}
    {!marketplaceOpen && (
      <button
        onClick={() => { haptic("light"); setMarketplaceOpen(true); }}
        className="w-full flex items-center gap-3 rounded-xl bg-card border border-border px-3.5 py-3 text-left shadow-sm transition-colors hover:bg-muted/40 active:scale-[0.99]"
      >
        <span className="flex -space-x-2 shrink-0">
          {teaserTutors.length > 0 ? (
            teaserTutors.map((t) => (
              <Avatar key={t.id} className="h-7 w-7 border-2 border-card">
                <AvatarImage src={t.avatar_url || "/placeholder.svg"} />
                <AvatarFallback className="text-[10px]">
                  {t.full_name?.split(" ").map((n) => n[0]).join("") || "T"}
                </AvatarFallback>
              </Avatar>
            ))
          ) : (
            <span className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
          {tutors.length > 3 && (
            <span className="h-7 w-7 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center text-[10px] font-bold text-primary">
              +{tutors.length - 3}
            </span>
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-foreground truncate">
            {tutorsLoading
              ? "Finding tutors near you…"
              : `${tutors.length} tutor${tutors.length === 1 ? "" : "s"} near ${userGeoLocation ? "you" : "Johannesburg Central"}`}
          </span>
          <span className="block text-xs text-muted-foreground truncate">
            {teaserSubject}{fromRate ? ` · from R${fromRate}/hour` : ""}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
      </button>
    )}

    {/* Full marketplace — search, filters, location, tutor cards */}
    {marketplaceOpen && (
    <div className="space-y-4">
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
          const rate = tutor.subjects[0]?.hourly_rate;
          const hasRate = rate !== null && rate !== undefined && Number(rate) > 0;
          const hasSubjects = tutor.subjects.length > 0 && !!tutor.subjects[0]?.subject;
          // Designed "profile being set up" state — no blank avatars or "R/hour".
          const profileIncomplete = !hasRate || !hasSubjects;
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
                        <h4 className="font-medium">{tutor.full_name || "New StudySync tutor"}</h4>
                        <p className="text-sm text-muted-foreground">
                          {hasSubjects
                            ? `${tutor.subjects.map((s) => s.subject).join(", ")}${tutor.subjects[0]?.level ? ` • ${tutor.subjects[0].level}` : ""}`
                            : "Subjects coming soon"}
                        </p>
                      </div>
                      <div className="text-right">
                        {hasRate ? (
                          <p className="font-semibold text-primary">R{rate}/hour</p>
                        ) : (
                          <p className="text-xs font-medium text-muted-foreground">Rate not set yet</p>
                        )}
                        <p className="text-xs text-muted-foreground">{tutor.distance}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {tutor.rating > 0 ? (
                        <>
                          <StarRating rating={tutor.rating} readonly size="sm" />
                          <span className="text-sm font-medium">{tutor.rating}</span>
                          {tutor.totalReviews > 0 && <span className="text-sm text-muted-foreground">({tutor.totalReviews})</span>}
                        </>
                      ) : (
                        // Spec: "New tutor" badge instead of a row of empty stars.
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                          <Sparkles className="h-3 w-3 mr-1" />
                          New tutor
                        </Badge>
                      )}
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

                    {profileIncomplete ? (
                      <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          This tutor's profile is being set up — booking opens once their subjects and rate are confirmed.
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <Button variant="outline" size="sm" className="flex-1" disabled>
                            <Video className="h-3.5 w-3.5 mr-1" />
                            Booking soon
                          </Button>
                          <Button variant="secondary" size="sm" className="flex-1 active:scale-95 transition-transform" onClick={() => { haptic("selection"); onStartChat(tutor); }}>
                            <MessageCircle className="h-3.5 w-3.5 mr-1" />
                            Chat
                          </Button>
                        </div>
                      </div>
                    ) : (
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
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
    </div>
    )}
  </div>
  );
};
