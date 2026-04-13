import { X, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VideoEmbedPlayer } from "@/components/VideoEmbedPlayer";
import type { LibraryResource } from "@/types/academicProfile";

interface VideoPlayerOverlayProps {
  resource: LibraryResource;
  onClose: () => void;
  onBookTutor: (tutorId: string, tutorName: string) => void;
}

export function VideoPlayerOverlay({
  resource,
  onClose,
  onBookTutor,
}: VideoPlayerOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border p-4 rounded-xl w-[95%] max-w-4xl shadow-2xl">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="font-semibold text-foreground truncate">{resource.title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
            <X className="h-4 w-4 mr-1" /> Close
          </Button>
        </div>

        <VideoEmbedPlayer
          url={resource.videoUrl || ""}
          title={resource.title}
        />

        {resource.tutor && (
          <div className="mt-4 flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-8 w-8">
                <AvatarImage src={resource.tutor.avatar_url || "/placeholder.svg"} />
                <AvatarFallback className="text-xs">
                  {resource.tutor.name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{resource.tutor.name}</p>
                <p className="text-xs text-muted-foreground">Book based on available time slots</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                onBookTutor(resource.tutor!.id, resource.tutor!.name);
                onClose();
              }}
            >
              <GraduationCap className="h-3 w-3 mr-1" />
              Book Tutor
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
