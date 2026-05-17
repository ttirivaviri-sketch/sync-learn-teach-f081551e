import { Book, FileText, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LibraryResource } from "@/types/academicProfile";

interface PosterCardProps {
  resource: LibraryResource;
  variant?: "portrait" | "landscape";
  onOpen: (resource: LibraryResource) => void;
}

/**
 * Netflix-style poster card. Tap → open/download directly.
 * Used for Books and Past Papers racks.
 */
export function PosterCard({ resource, variant = "portrait", onOpen }: PosterCardProps) {
  const isPaper = resource.type === "pastpaper";
  const Icon = isPaper ? FileText : Book;
  const isOfficial = resource.author === "studysyncofficial";

  return (
    <button
      onClick={() => onOpen(resource)}
      className={`group relative shrink-0 overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all hover:scale-[1.02] ${
        variant === "portrait" ? "w-36 h-52" : "w-64 h-36"
      }`}
    >
      {/* Cover */}
      {resource.thumbnail && resource.thumbnail !== "/placeholder.svg" ? (
        <img
          src={resource.thumbnail}
          alt={resource.title}
          width={variant === "portrait" ? 144 : 256}
          height={variant === "portrait" ? 208 : 144}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div
          className={`absolute inset-0 flex items-center justify-center ${
            isPaper
              ? "bg-gradient-to-br from-orange-500/30 via-orange-700/40 to-orange-900/60"
              : "bg-gradient-to-br from-primary/30 via-primary/50 to-primary/80"
          }`}
        >
          <Icon className="h-12 w-12 text-white/80" />
        </div>
      )}

      {/* Top badge */}
      <Badge
        className={`absolute top-2 left-2 text-[10px] border-0 ${
          isPaper ? "bg-orange-500 text-white" : "bg-primary text-primary-foreground"
        }`}
      >
        {isPaper ? "Past Paper" : resource.type === "guide" ? "Guide" : "Book"}
      </Badge>

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2.5">
        <h4 className="text-white font-semibold text-xs leading-tight line-clamp-2 mb-1">
          {resource.title}
        </h4>
        <div className="flex items-center gap-1">
          <span className="text-white/70 text-[10px] truncate">{resource.author}</span>
          {isOfficial && (
            <BadgeCheck className="h-3 w-3 text-blue-400 fill-blue-400/30 shrink-0" />
          )}
        </div>
      </div>
    </button>
  );
}
