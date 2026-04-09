/**
 * LearnerHomeTab — Search, subject filters, location, tutor cards.
 */
import { MapPin, Video, MessageCircle, Search, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AdvancedBooking } from "@/components/AdvancedBooking";
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
}: LearnerHomeTabProps) => (
  <div className="space-y-4 p-4 mt-0">
    <AdvancedBooking />

    {/* Search Bar */}
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search by subject or tutor name..." className="pl-9" />
    </div>

    {/* Quick Subject Filters */}
    <div className="flex gap-2 overflow-x-auto pb-2">
      {allSubjects.map((subject) => (
        <Badge key={subject} variant={selectedSubject === subject ? "default" : "outline"} className="cursor-pointer whitespace-nowrap" onClick={() => onSelectSubject(selectedSubject === subject ? "" : subject)}>
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
            <Card key={tutor.id} className="shadow-sm">
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
                      <Button variant="outline" className="flex-1" onClick={() => onBookTutor(tutor)}>
                        <MapPin className="h-3 w-3 mr-1" />
                        In-Person
                      </Button>
                      <Button variant="default" className="flex-1" onClick={() => onBookTutor(tutor)}>
                        <Video className="h-4 w-4 mr-1" />
                        Book Online
                      </Button>
                      <Button variant="secondary" className="flex-1" onClick={() => onStartChat(tutor)}>
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
