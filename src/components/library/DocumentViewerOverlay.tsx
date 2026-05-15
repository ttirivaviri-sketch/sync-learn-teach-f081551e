import { useEffect, useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LibraryResource } from "@/types/academicProfile";
import { useProtectedPdfBlob } from "@/hooks/useProtectedPdfBlob";

// Use the bundled worker so it works offline / inside the preview iframe.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface DocumentViewerOverlayProps {
  resource: LibraryResource;
  onClose: () => void;
}

/**
 * Protected in-app PDF reader. The PDF bytes are fetched through the
 * `library-stream` Edge Function (JWT-checked) into an in-memory blob URL
 * – no public Storage URL is ever exposed. Download / open-in-new-tab /
 * right-click / print are all suppressed to discourage casual extraction.
 */
export function DocumentViewerOverlay({
  resource,
  onClose,
}: DocumentViewerOverlayProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [renderError, setRenderError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(0);

  const { url, loading, error } = useProtectedPdfBlob(
    String(resource.id),
    resource.pdfSource ?? null,
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setPageWidth(el.clientWidth - 16);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPageNumber(1);
  }, []);

  const goPrev = () => setPageNumber((p) => Math.max(1, p - 1));
  const goNext = () => setPageNumber((p) => Math.min(numPages, p + 1));
  const zoomIn = () => setScale((s) => Math.min(2.5, +(s + 0.2).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.6, +(s - 0.2).toFixed(2)));

  const blocked = error || renderError;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 p-2 print:hidden sm:p-4"
      onContextMenu={(e) => e.preventDefault()}
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
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

          <div className="flex shrink-0 items-center gap-1">
            {!blocked && numPages > 0 && (
              <>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={zoomOut} title="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={zoomIn} title="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div ref={containerRef} className="relative flex-1 overflow-auto bg-muted/40">
          {loading && !url ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Preparing secure document…</p>
            </div>
          ) : blocked || !url ? (
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
            <div className="flex justify-center py-3">
              <Document
                file={url}
                onLoadSuccess={onLoadSuccess}
                onLoadError={() => setRenderError(true)}
                onSourceError={() => setRenderError(true)}
                loading={
                  <div className="flex flex-col items-center gap-2 py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Loading document…</p>
                  </div>
                }
                error={
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Couldn't render this PDF.
                  </div>
                }
              >
                {pageWidth > 0 && (
                  <Page
                    pageNumber={pageNumber}
                    width={pageWidth * scale}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    loading={
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    }
                  />
                )}
              </Document>
            </div>
          )}
        </div>

        {/* Pager */}
        {!blocked && numPages > 0 && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={goPrev}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {pageNumber} of {numPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={goNext}
              disabled={pageNumber >= numPages}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
