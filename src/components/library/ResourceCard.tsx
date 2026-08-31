import { useState } from "react";
import {
  Star, Download, Bookmark, Eye, X, BadgeCheck,
} from "lucide-react";
import { SyncPlayButton } from "@/components/ui/SyncPlayButton";
import { GeneratedCover } from "./GeneratedCover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { LibraryResource } from "@/types/academicProfile";

interface ResourceCardProps {
  resource: LibraryResource;
  isInLibrary: boolean;
  onOpen: (resource: LibraryResource) => void;
  onBookTutor: (tutorId: string, tutorName: string) => void;
  onDownload: (id: string, title: string) => void;
  onAddToLibrary: (id: string, title: string) => void;
  onRemoveFromLibrary: (id: string) => void;
}

export function ResourceCard({
  resource,
  isInLibrary,
  onOpen,
  onBookTutor,
  onDownload,
  onAddToLibrary,
  onRemoveFromLibrary,
}: ResourceCardProps) {
  const id = String(resource.id);
  const [imgFailed, setImgFailed] = useState(false);
  const hasCover =
    !!resource.thumbnail && resource.thumbnail !== "/placeholder.svg" && !imgFailed;

  const isOfficial =
    (resource.tutor?.name === "studysyncofficial") ||
    resource.author === "studysyncofficial";

  return (
    <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-4">
        {/* Thumbnail */}
        <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
          {hasCover ? (
            <img
              src={resource.thumbnail}
              alt={resource.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="absolute inset-0">
              <GeneratedCover
                title={resource.title}
                label={
                  resource.type === "pastpaper"
                    ? "Past Paper"
                    : resource.tags?.subject || resource.category
                }
              />
            </div>
          )}

          {resource.type === "video" && (
            <div className="absolute inset-0 flex items-center justify-center group">
              <SyncPlayButton decorative size={44} />
            </div>
          )}

          {resource.isOffline && (
            <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
              <Download className="h-3 w-3 mr-1" />
              Offline
            </Badge>
          )}

          {resource.isTutorial && (
            <Badge className="absolute top-2 left-2 text-xs bg-emerald-600">
              Tutorial
            </Badge>
          )}

          {resource.type === "pastpaper" && (
            <Badge className="absolute top-2 left-2 text-xs bg-orange-500">
              Past Paper
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          {/* Title + bookmark */}
          <div className="flex items-start justify-between gap-1">
            <h4 className="font-medium text-sm leading-tight line-clamp-2">
              {resource.title}
            </h4>
            {isInLibrary && (
              <Bookmark className="h-4 w-4 text-primary fill-primary flex-shrink-0 ml-1" />
            )}
          </div>

          {/* Author / Tutor */}
          {resource.tutor ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={resource.tutor.avatar_url || "/placeholder.svg"} />
                <AvatarFallback className="text-[10px]">
                  {resource.tutor.name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">
                {resource.tutor.name}
              </span>
              {isOfficial && (
                <BadgeCheck className="h-3.5 w-3.5 text-blue-500 fill-blue-500/20 shrink-0" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">{resource.author}</p>
              {isOfficial && (
                <BadgeCheck className="h-3.5 w-3.5 text-blue-500 fill-blue-500/20 shrink-0" />
              )}
            </div>
          )}

          {/* Grade */}
          <p className="text-xs text-accent-foreground">{resource.gradeLevel}</p>

          {/* Rating — only when real rating data exists ("0 ★ (0)" looks broken) */}
          {(resource.rating > 0 || (resource.watchCount ?? 0) > 0) && (
            <div className="flex items-center gap-1">
              {resource.rating > 0 && (
                <>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs font-medium">{resource.rating}</span>
                  <span className="text-xs text-muted-foreground">({resource.reviews})</span>
                </>
              )}
              {resource.watchCount ? (
                <span className="text-xs text-muted-foreground ml-1">
                  · {resource.watchCount.toLocaleString()} views
                </span>
              ) : null}
            </div>
          )}

          {/* Summary */}
          <p className="text-xs text-muted-foreground line-clamp-2">
            {resource.summary}
          </p>

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{resource.duration}</span>
            <span>{resource.category}</span>
          </div>

          {/* Subject tags */}
          {resource.tags && (
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {resource.tags.subject}
              </Badge>
              {resource.tags.topic && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {resource.tags.topic}
                </Badge>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1"
              size="sm"
              onClick={() => onOpen(resource)}
            >
              <Eye className="h-3 w-3 mr-1" />
              {resource.type === "video" ? "Watch" : "View"}
            </Button>

            {resource.tutor && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => onBookTutor(resource.tutor!.id, resource.tutor!.name)}
              >
                Book Tutor
              </Button>
            )}

            {/* Download only for document types with an attached file */}
            {!resource.tutor &&
              ["book", "guide", "pastpaper", "pdf"].includes(resource.type) &&
              !!resource.videoUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(id, resource.title)}
                aria-label={`Download ${resource.title}`}
              >
                <Download className="h-3 w-3" />
              </Button>
            )}

            {!isInLibrary && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddToLibrary(id, resource.title)}
              >
                <Bookmark className="h-3 w-3" />
              </Button>
            )}
            {isInLibrary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveFromLibrary(id)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
