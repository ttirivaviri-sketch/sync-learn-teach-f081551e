import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LibraryResource } from "@/types/academicProfile";

interface DocumentViewerOverlayProps {
  resource: LibraryResource;
  documentUrl: string;
  onClose: () => void;
}

/**
 * Mobile-friendly in-app PDF viewer.
 * Uses Mozilla's hosted PDF.js viewer (works on iOS Safari + Android),
 * with a graceful fallback when the PDF can't be embedded.
 */
export function DocumentViewerOverlay({
  resource,
  documentUrl,
  onClose,
}: DocumentViewerOverlayProps) {
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  // Use Mozilla PDF.js hosted viewer for reliable mobile rendering
  const pdfJsViewer = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
    documentUrl
  )}`;

  // Safety net: if iframe never reports load within 12s, show fallback
  useEffect(() => {
    const t = window.setTimeout(() => {
      setLoading((prev) => {
        if (prev) setErrored(true);
        return false;
      });
    }, 12000);
    return () => window.clearTimeout(t);
  }, [documentUrl]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-2 sm:p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
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

          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
              <a href={documentUrl} target="_blank" rel="noopener noreferrer" title="Open in new tab">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
              <a href={documentUrl} download title="Download">
                <Download className="h-4 w-4" />
              </a>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative flex-1 bg-muted/40">
          {loading && !errored && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading document…</p>
            </div>
          )}

          {errored ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-foreground">
                This document can't be previewed in-app.
              </p>
              <p className="text-xs text-muted-foreground">
                Open it in a new tab or download to read.
              </p>
              <div className="flex gap-2 pt-2">
                <Button asChild size="sm">
                  <a href={documentUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-4 w-4" />
                    Open in new tab
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={documentUrl} download>
                    <Download className="mr-1 h-4 w-4" />
                    Download
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <iframe
              key={documentUrl}
              src={pdfJsViewer}
              title={resource.title}
              className="h-full w-full border-0 bg-background"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setErrored(true);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
