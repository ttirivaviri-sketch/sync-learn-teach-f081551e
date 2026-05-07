import { useEffect, useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LibraryResource } from "@/types/academicProfile";

// Use the bundled worker so it works offline / inside the preview iframe.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface DocumentViewerOverlayProps {
  resource: LibraryResource;
  documentUrl: string;
  onClose: () => void;
}

/**
 * In-app PDF reader (mobile + desktop) using react-pdf.
 * Falls back to "Open in new tab" / "Download" if the file can't be loaded
 * (CORS, 404, non-PDF, etc.) so the overlay never sits on a dead spinner.
 */
export function DocumentViewerOverlay({
  resource,
  documentUrl,
  onClose,
}: DocumentViewerOverlayProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [errored, setErrored] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(0);

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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-2 sm:p-4">
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
            {!errored && numPages > 0 && (
              <>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={zoomOut} title="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={zoomIn} title="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </>
            )}
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

        {/* Body */}
        <div ref={containerRef} className="relative flex-1 overflow-auto bg-muted/40">
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
            <div className="flex justify-center py-3">
              <Document
                file={documentUrl}
                onLoadSuccess={onLoadSuccess}
                onLoadError={() => setErrored(true)}
                onSourceError={() => setErrored(true)}
                loading={
                  <div className="flex flex-col items-center gap-2 py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Loading document…</p>
                  </div>
                }
                error={
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Couldn't load this PDF.
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
        {!errored && numPages > 0 && (
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
