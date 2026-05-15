import { FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LibraryResource } from "@/types/academicProfile";
import { useProtectedPdfBlob } from "@/hooks/useProtectedPdfBlob";

interface DocumentViewerOverlayProps {
  resource: LibraryResource;
  onClose: () => void;
}

/**
 * In-app PDF reader. The PDF URL (signed bucket URL or external upstream)
 * is resolved through the authenticated `library-stream` Edge Function and
 * rendered in an <iframe>, which lets the browser's built-in PDF viewer
 * handle pagination, zoom, and very large files.
 */
export function DocumentViewerOverlay({
  resource,
  onClose,
}: DocumentViewerOverlayProps) {
  const { url, loading, error } = useProtectedPdfBlob(
    String(resource.id),
    resource.pdfSource ?? null,
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-2 print:hidden sm:p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>{resource.type === "pastpaper" ? "Past paper" : "Study material"}</span>
            </div>
            <h3 className="truncate text-sm font-semibold text-foreground">
              {resource.title}
            </h3>
          </div>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-hidden bg-muted/40">
          {loading && !url ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Preparing document…</p>
            </div>
          ) : error || !url ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-foreground">
                This document can't be opened right now.
              </p>
              <p className="text-xs text-muted-foreground">
                {error || "Please try again in a moment."}
              </p>
            </div>
          ) : (
            <iframe
              src={url}
              title={resource.title}
              className="h-full w-full"
              // sandbox kept loose so the browser PDF viewer's built-in
              // controls (zoom/pagination/search) remain available.
            />
          )}
        </div>
      </div>
    </div>
  );
}
