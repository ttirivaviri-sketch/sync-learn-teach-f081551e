import { ChevronRight } from "lucide-react";
import type { LibraryResource } from "@/types/academicProfile";
import { ResourceCard } from "./ResourceCard";

interface ContentRackProps {
  title: string;
  items: LibraryResource[];
  emptyMessage?: string;
  icon?: React.ElementType;
  myLibraryItems: string[];
  onOpen: (resource: LibraryResource) => void;
  onBookTutor: (tutorId: string, tutorName: string) => void;
  onDownload: (id: string, title: string) => void;
  onAddToLibrary: (id: string, title: string) => void;
  onRemoveFromLibrary: (id: string) => void;
}

export function ContentRack({
  title,
  items,
  emptyMessage,
  icon: Icon,
  myLibraryItems,
  onOpen,
  onBookTutor,
  onDownload,
  onAddToLibrary,
  onRemoveFromLibrary,
}: ContentRackProps) {
  if (items.length === 0 && !emptyMessage) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-primary" />}
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.slice(0, 4).map((resource) => (
            <ResourceCard
              key={String(resource.id)}
              resource={resource}
              isInLibrary={myLibraryItems.includes(String(resource.id))}
              onOpen={onOpen}
              onBookTutor={onBookTutor}
              onDownload={onDownload}
              onAddToLibrary={onAddToLibrary}
              onRemoveFromLibrary={onRemoveFromLibrary}
            />
          ))}
        </div>
      )}
    </div>
  );
}
