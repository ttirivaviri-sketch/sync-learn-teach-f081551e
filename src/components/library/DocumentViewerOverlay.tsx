import { useRef, useState } from "react";
import {
  FileText,
  Loader2,
  X,
  ExternalLink,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LibraryResource } from "@/types/academicProfile";
import { useProtectedPdfBlob } from "@/hooks/useProtectedPdfBlob";
import { PdfJsViewer } from "./PdfJsViewer";
import { ResourceChatPanel } from "./ResourceChatPanel";

interface DocumentViewerOverlayProps {
  resource: LibraryResource;
  onClose: () => void;
}

/**
 * In-app document reader.
 *
 * Flow:
 * 1. `useProtectedPdfBlob` calls the authenticated `library-stream` Edge
 *    Function, resolves { url, kind }, and fetches the raw PDF bytes
 *    (direct fetch first, CORS-proxy fallback).
 * 2. With bytes in hand, renders a REAL scrollable reader via pdf.js
 *    (PdfJsViewer) — every page, zoom, page indicator. This fixes the
 *    iOS Safari iframe limitation where only page 1 was visible.
 * 3. "Ask AI" opens a docked chat panel (ResourceChatPanel) that reads the
 *    document's extracted text, so learners can ask about the material
 *    while viewing it.
 * 4. Fallbacks preserved: bytes unavailable → iframe (desktop browsers can
 *    still scroll those); webpage kinds → "Open in browser" card; legacy
 *    seeds without pdfSource → open stored URL in a new tab.
 */
export function DocumentViewerOverlay({
  resource,
  onClose,
}: DocumentViewerOverlayProps) {
  const { url, data, loading, error, kind } = useProtectedPdfBlob(
    String(resource.id),
    resource.pdfSource ?? null,
  );

  const [showChat, setShowChat] = useState(false);
  const [pdfRenderFailed, setPdfRenderFailed] = useState(false);
  // Text extractor handed up from PdfJsViewer once the doc parses.
  const extractorRef = useRef<(() => Promise<string>) | null>(null);
  const [extractorReady, setExtractorReady] = useState(false);

  // Determine display label
  const paperBits = [
    resource.paperMeta?.year,
    resource.paperMeta?.session,
    resource.paperMeta?.paperNumber,
  ].filter(Boolean);
  const typeLabel =
    resource.type === "pastpaper"
      ? paperBits.length > 0
        ? `Past paper · ${paperBits.join(" ")}`
        : "Past paper"
      : resource.type === "guide"
      ? "Study guide"
      : "Study material";

  // ── No pdfSource means it's a legacy/fallback seed with a direct URL.
  // Open it immediately in a new tab instead of trying the edge function.
  const isUuid = /^[0-9a-f-]{36}$/i.test(String(resource.id));
  if ((!resource.pdfSource || !isUuid) && resource.videoUrl) {
    window.open(resource.videoUrl, "_blank", "noopener,noreferrer");
    onClose();
    return null;
  }

  const canRenderInApp = !!data && !pdfRenderFailed;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-2 print:hidden sm:p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>{typeLabel}</span>
            </div>
            <h3 className="truncate text-sm font-semibold text-foreground">
              {resource.title}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {/* Ask AI — only meaningful once we have a readable document */}
            {canRenderInApp && (
              <Button
                variant={showChat ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs"
                onClick={() => setShowChat((v) => !v)}
                title="Ask AI about this document"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ask AI</span>
              </Button>
            )}
            {/* Marking scheme — opens the official scheme alongside the paper */}
            {resource.paperMeta?.markingSchemeUrl && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() =>
                  window.open(
                    resource.paperMeta!.markingSchemeUrl!,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
                title="Open marking scheme"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Marking scheme</span>
              </Button>
            )}
            {/* Open externally button — always visible once we have a URL */}
            {url && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs"
                onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                title="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Open in browser</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="relative flex flex-1 flex-col overflow-hidden bg-muted/40 sm:flex-row">
          {/* ── Document pane ── */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {/* ── Loading ── */}
            {loading && !url && (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Preparing document…</p>
              </div>
            )}

            {/* ── Error ── */}
            {!loading && (error || !url) && (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  This document can't be opened right now.
                </p>
                <p className="text-xs text-muted-foreground">
                  {error || "Please try again in a moment."}
                </p>
              </div>
            )}

            {/* ── Web page (Siyavula, CK-12, Gutenberg HTML, etc.) ── */}
            {!loading && url && kind === "webpage" && (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <ExternalLink className="h-8 w-8 text-primary" />
                </div>
                <div className="max-w-sm space-y-2">
                  <h4 className="text-base font-semibold text-foreground">
                    Opens in your browser
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    This resource is hosted on an external site and needs to be
                    viewed in a new browser tab. Click below — it's free and no
                    account is required.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="gap-2"
                    onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open {resource.author ? `on ${resource.author}` : "in browser"}
                  </Button>
                  <Button variant="outline" onClick={onClose}>
                    Back to Library
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground/70">
                  Source: {url}
                </p>
              </div>
            )}

            {/* ── In-app scrollable PDF reader (pdf.js) ── */}
            {!loading && url && kind !== "webpage" && canRenderInApp && (
              <PdfJsViewer
                data={data!}
                title={resource.title}
                onReady={(extract) => {
                  extractorRef.current = extract;
                  setExtractorReady(true);
                }}
                onError={() => setPdfRenderFailed(true)}
              />
            )}

            {/* ── Fallback: iframe (bytes unavailable or pdf.js failed) ── */}
            {!loading && url && kind !== "webpage" && !canRenderInApp && (
              <iframe
                src={url}
                title={resource.title}
                className="h-full w-full"
                // Keep sandbox loose so browser PDF viewer controls work
              />
            )}
          </div>

          {/* ── AI chat pane ── */}
          {showChat && canRenderInApp && (
            <div className="h-[45%] w-full border-t border-border sm:h-auto sm:w-[340px] sm:border-l sm:border-t-0">
              <ResourceChatPanel
                resource={resource}
                getDocumentText={extractorReady ? extractorRef.current : null}
                onClose={() => setShowChat(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
