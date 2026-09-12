/**
 * PdfJsViewer — true in-app, scrollable PDF reader built on pdf.js.
 *
 * Why not <iframe>? iOS Safari renders iframed PDFs as a single static
 * image of page 1 — learners could never scroll past the cover. pdf.js
 * renders every page to a canvas inside a normal scrollable div, which
 * works identically on iOS, Android and desktop.
 *
 * Features:
 *  - Lazy page rendering via IntersectionObserver (only visible pages
 *    are rasterized — a 20-page paper stays smooth on low-end phones)
 *  - Zoom controls (fit-width baseline, 60%–300%)
 *  - Page indicator ("3 / 20")
 *  - Exposes a text extractor so the AI panel can read the document
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — legacy build avoids top-level await (same pattern as pdfExtractor)
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite worker URL
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Max pages read when extracting text for the AI panel. */
const MAX_TEXT_PAGES = 40;

interface PdfJsViewerProps {
  /** URL pdf.js streams from (range requests → page 1 paints early). */
  src: string;
  /** Extra headers pdf.js must send (proxy auth). */
  httpHeaders?: Record<string, string>;
  title: string;
  /**
   * Called once the document is ready with a lazy text extractor the AI
   * chat panel can invoke (result is cached by the caller).
   */
  onReady?: (extractText: () => Promise<string>) => void;
  /** Called when pdf.js cannot parse the bytes (caller may fall back). */
  onError?: (message: string) => void;
}

// pdf.js document/page types are loose in the legacy build.
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy?: () => void };
type PdfPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
};

export function PdfJsViewer({ src, httpHeaders, title, onReady, onError }: PdfJsViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Keep latest callbacks without retriggering the load effect
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const headersKey = JSON.stringify(httpHeaders ?? null);

  // ── Load document ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let loadedDoc: PdfDoc | null = null;

    (async () => {
      try {
        // Stream from the URL: pdf.js requests only the ranges it needs, so
        // the first page renders long before a big textbook finishes.
        const task = pdfjsLib.getDocument({
          url: src,
          httpHeaders: httpHeaders ?? undefined,
          rangeChunkSize: 262144,
          disableAutoFetch: true,
          disableStream: false,
        });
        const pdf = (await task.promise) as PdfDoc;
        if (cancelled) {
          pdf.destroy?.();
          return;
        }
        loadedDoc = pdf;
        setDoc(pdf);
        setNumPages(pdf.numPages);


        // Lazy text extractor for the AI panel
        onReadyRef.current?.(async () => {
          const pages: string[] = [];
          const limit = Math.min(pdf.numPages, MAX_TEXT_PAGES);
          for (let p = 1; p <= limit; p++) {
            try {
              const page = await pdf.getPage(p);
              const content = await page.getTextContent();
              const text = content.items
                .map((it) => it.str ?? "")
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();
              if (text) pages.push(`## Page ${p}\n${text}`);
            } catch {
              /* skip unreadable page */
            }
          }
          return pages.join("\n\n");
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Could not open PDF";
        setLoadError(msg);
        onErrorRef.current?.(msg);
      }
    })();

    return () => {
      cancelled = true;
      loadedDoc?.destroy?.();
    };
  }, [data]);

  // ── Track which page is in view (for the "3 / 20" indicator) ─────────────
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const mid = container.scrollTop + container.clientHeight / 2;
    const children = container.querySelectorAll<HTMLElement>("[data-page]");
    for (const el of children) {
      if (el.offsetTop <= mid && el.offsetTop + el.offsetHeight >= mid) {
        setCurrentPage(Number(el.dataset.page) || 1);
        break;
      }
    }
  }, []);

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium text-foreground">Couldn't render this PDF.</p>
        <p className="text-xs text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Opening document…</p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {/* Scrollable page list */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-auto overscroll-contain bg-muted/60 px-2 py-3"
        style={{ WebkitOverflowScrolling: "touch" }}
        aria-label={`${title} — PDF reader`}
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
          {Array.from({ length: numPages }, (_, i) => (
            <PdfPageCanvas key={i + 1} doc={doc} pageNum={i + 1} zoom={zoom} />
          ))}
        </div>
      </div>

      {/* Floating controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-background/95 px-2 py-1 shadow-lg backdrop-blur">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))}
            aria-label="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))}
            aria-label="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <span className="ml-1 border-l border-border pl-2 text-xs tabular-nums text-muted-foreground">
            {currentPage} / {numPages}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Single lazily-rendered page ─────────────────────────────────────────────

function PdfPageCanvas({ doc, pageNum, zoom }: { doc: PdfDoc; pageNum: number; zoom: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(pageNum <= 2); // render first pages eagerly
  const [aspect, setAspect] = useState(1.414); // A4 fallback until measured
  const renderedRef = useRef<{ zoom: number } | null>(null);

  // Observe visibility (generous margin so pages render just before arrival)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || visible) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  // Render (and re-render on zoom change)
  useEffect(() => {
    if (!visible) return;
    if (renderedRef.current?.zoom === zoom) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        setAspect(base.height / base.width);

        const wrap = wrapRef.current;
        const canvas = canvasRef.current;
        if (!wrap || !canvas) return;

        // Fit-width baseline × zoom, rendered at devicePixelRatio for crisp text
        const cssWidth = wrap.clientWidth * zoom;
        const scale = cssWidth / base.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * dpr });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(cssWidth)}px`;
        canvas.style.height = `${Math.floor(cssWidth * (base.height / base.width))}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) renderedRef.current = { zoom };
      } catch {
        /* page render failed — placeholder stays */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, zoom, doc, pageNum]);

  return (
    <div
      ref={wrapRef}
      data-page={pageNum}
      className="w-full overflow-x-auto rounded-md bg-white shadow-sm"
      style={{ minHeight: visible ? undefined : `${Math.round(320 * aspect)}px` }}
    >
      <canvas ref={canvasRef} className="mx-auto block" />
    </div>
  );
}
