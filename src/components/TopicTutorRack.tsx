import { Star, Video, TrendingUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LibraryResource } from "@/types/academicProfile";

interface TopicTutorRackProps {
  title: string;
  subtitle?: string;
  tutors: LibraryResource[];   // resources that have a .tutor property
  onBookTutor?: (tutorId: string, tutorName: string) => void;
  onWatchTutorial?: (resource: LibraryResource) => void;
}

export function TopicTutorRack({
  title,
  subtitle,
  tutors,
  onBookTutor,
  onWatchTutorial,
}: TopicTutorRackProps) {
  if (tutors.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <TrendingUp className="h-4 w-4 text-primary" />
      </div>

      <div className="space-y-2">
        {tutors.slice(0, 5).map((resource, index) => {
          const tutor = resource.tutor!;
          return (
            <Card key={`${tutor.id}-${index}`} className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  {/* Rank badge */}
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                  </div>

                  {/* Avatar */}
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={tutor.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback>
                      {tutor.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{tutor.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {resource.tags?.subject} · {resource.tags?.topic}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-semibold">
                          {tutor.topic_rating ?? tutor.rating}
                        </span>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Users className="h-3 w-3" />
                        {tutor.reviews} reviews
                      </span>
                      {resource.completionRate !== undefined && (
                        <span className="flex items-center gap-0.5">
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          {resource.completionRate}% completion
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={() => onWatchTutorial?.(resource)}
                      >
                        <Video className="h-3 w-3 mr-1" />
                        Watch
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={() => onBookTutor?.(tutor.id, tutor.name)}
                      >
                        Book Tutor
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
