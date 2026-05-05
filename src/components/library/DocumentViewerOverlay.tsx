import { ExternalLink, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LibraryResource } from "@/types/academicProfile";

interface DocumentViewerOverlayProps {
  resource: LibraryResource;
  documentUrl: string;
  onClose: () => void;
}

export function DocumentViewerOverlay({
  resource,
  documentUrl,
  onClose,
}: DocumentViewerOverlayProps) {
  const viewerUrl = documentUrl.includes("#")
    ? documentUrl
    : `${documentUrl}#toolbar=1&navpanes=0&view=FitH`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-3 sm:p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{resource.type === "pastpaper" ? "Past paper" : "Study material"}</span>
            </div>
            <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">
              {resource.title}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={documentUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-4 w-4" />
                Open in new tab
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="mr-1 h-4 w-4" />
              Close
            </Button>
          </div>
        </div>

        <iframe
          key={documentUrl}
          src={viewerUrl}
          title={resource.title}
          className="h-full w-full bg-background"
        />
      </div>
    </div>
  );
}