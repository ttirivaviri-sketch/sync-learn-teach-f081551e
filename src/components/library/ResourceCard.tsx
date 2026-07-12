import {
  Star, Download, Book, FileText, Video, Bookmark, Eye, Play, X, BadgeCheck,
} from "lucide-react";
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
  const TypeIcon =
    resource.type === "video"
      ? Video
      : resource.type === "pastpaper"
      ? FileText
      : Book;

  const isOfficial =
    (resource.tutor?.name === "studysyncofficial") ||
    resource.author === "studysyncofficial";

  return (
    <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-4">
        {/* Thumbnail */}
        <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
          {resource.type === "video" ? (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                <Play className="h-5 w-5 text-primary ml-0.5" />
              </div>
            </div>
          ) : (
            <TypeIcon className="h-8 w-8 text-muted-foreground" />
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

          {/* Rating */}
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium">{resource.rating}</span>
            <span className="text-xs text-muted-foreground">({resource.reviews})</span>
            {resource.watchCount ? (
              <span className="text-xs text-muted-foreground ml-1">
                · {resource.watchCount.toLocaleString()} views
              </span>
            ) : null}
          </div>

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

            {!resource.tutor && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(id, resource.title)}
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
