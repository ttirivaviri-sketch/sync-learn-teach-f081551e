import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, X, Sparkles, Send, ImageOff, MessageCircleQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";
import { MathMarkdown } from "@/studymode/components/MathMarkdown";
import type { AcademicProfile, LibraryResource } from "@/types/academicProfile";

const SUPABASE_URL = "https://uynoykcratwbcdzmsxfw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5bm95a2NyYXR3YmNkem1zeGZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNDYwMTksImV4cCI6MjA2OTYyMjAxOX0.bjshrxxGsSJNUndDl7WCvqMpN9ewEXiTVX6g5PlbXGc";

type ChatMessage = { role: "user" | "assistant"; content: string };

interface DiagramViewerOverlayProps {
  resource: LibraryResource;
  academicProfile?: AcademicProfile | null;
  onClose: () => void;
}

/** Build auth headers for direct edge-function fetch (needed for streaming). */
async function edgeHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
  };
}

/**
 * Full-screen viewer for AI-rendered study diagrams.
 *
 * - Shows the cached diagram image immediately when available.
 * - If the diagram hasn't been rendered yet, calls the
 *   `generate-library-diagram` edge function (renders once, cached forever).
 * - "Ask about this diagram" chat panel streams curriculum-depth answers
 *   from the `explain-diagram` edge function, grounded in the diagram spec.
 */
export function DiagramViewerOverlay({
  resource,
  academicProfile,
  onClose,
}: DiagramViewerOverlayProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(resource.imageUrl ?? null);
  const [rendering, setRendering] = useState(!resource.imageUrl);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Render (or fetch cached) diagram on open ──────────────────────────
  useEffect(() => {
    if (imageUrl) return;
    let cancelled = false;

    (async () => {
      try {
        setRendering(true);
        setRenderError(null);
        const headers = await edgeHeaders();
        const resp = await fetch(
          `${SUPABASE_URL}/functions/v1/generate-library-diagram`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ resourceId: String(resource.id) }),
          },
        );
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data?.error || `Render failed (${resp.status})`);
        if (!cancelled && data?.url) setImageUrl(data.url);
      } catch (err) {
        logger.warn("[DiagramViewer] render error:", err);
        if (!cancelled)
          setRenderError(
            err instanceof Error ? err.message : "Could not render this diagram.",
          );
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Explain chat (streams SSE from explain-diagram) ───────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatLoading) return;

      const userMsg: ChatMessage = { role: "user", content: trimmed };
      const history = [...messages, userMsg];
      setMessages(history);
      setInput("");
      setChatLoading(true);
      setChatError(null);

      let assistantSoFar = "";
      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
            );
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      try {
        const headers = await edgeHeaders();
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/explain-diagram`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            resourceId: String(resource.id),
            messages: history,
            curriculum: academicProfile?.curriculum,
            gradeLevel: academicProfile?.grade,
          }),
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({} as { error?: string }));
          throw new Error(errData?.error || "Failed to get an answer");
        }
        if (!resp.body) throw new Error("No response body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") { streamDone = true; break; }
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsertAssistant(content);
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }
      } catch (err) {
        logger.error("[DiagramViewer] chat error:", err);
        setChatError(err instanceof Error ? err.message : "Failed to send message");
        setMessages((prev) =>
          prev[prev.length - 1]?.role === "user" ? prev.slice(0, -1) : prev,
        );
      } finally {
        setChatLoading(false);
      }
    },
    [messages, chatLoading, resource.id, academicProfile],
  );

  const starterQuestions = [
    "Explain this diagram to me",
    "How is this examined?",
    "Quiz me on the labels",
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-2 print:hidden sm:p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                Study diagram{resource.category ? ` · ${resource.category}` : ""}
              </span>
            </div>
            <h3 className="truncate text-sm font-semibold text-foreground">
              {resource.title}
            </h3>
          </div>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body: diagram (top / left) + chat (bottom / right) */}
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {/* ── Diagram panel ── */}
          <div className="relative flex min-h-[38%] flex-1 items-center justify-center overflow-auto bg-muted/40 p-3 md:min-h-0">
            {rendering && (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Drawing your diagram…
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    First open takes ~15 seconds. It's saved forever after this.
                  </p>
                </div>
              </div>
            )}

            {!rendering && renderError && (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <ImageOff className="h-9 w-9 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  Couldn't render this diagram.
                </p>
                <p className="text-xs text-muted-foreground">{renderError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImageUrl(null);
                    setRenderError(null);
                    setRendering(true);
                    // re-trigger effect by resetting state; effect keyed on id
                    // won't rerun, so call directly:
                    (async () => {
                      try {
                        const headers = await edgeHeaders();
                        const resp = await fetch(
                          `${SUPABASE_URL}/functions/v1/generate-library-diagram`,
                          {
                            method: "POST",
                            headers,
                            body: JSON.stringify({ resourceId: String(resource.id) }),
                          },
                        );
                        const data = await resp.json().catch(() => ({}));
                        if (!resp.ok) throw new Error(data?.error || "Render failed");
                        if (data?.url) setImageUrl(data.url);
                      } catch (err) {
                        setRenderError(
                          err instanceof Error ? err.message : "Could not render this diagram.",
                        );
                      } finally {
                        setRendering(false);
                      }
                    })();
                  }}
                >
                  Try again
                </Button>
              </div>
            )}

            {!rendering && !renderError && imageUrl && (
              <img
                src={imageUrl}
                alt={resource.title}
                className="max-h-full max-w-full rounded-lg object-contain shadow-md"
              />
            )}
          </div>

          {/* ── Explain chat panel ── */}
          <div className="flex w-full flex-col border-t border-border md:w-[380px] md:border-l md:border-t-0">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <MessageCircleQuestion className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">
                Ask about this diagram
              </span>
              {academicProfile && (
                <span className="ml-auto truncate text-[10px] text-muted-foreground">
                  {academicProfile.curriculum} · {academicProfile.grade}
                </span>
              )}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Get a full curriculum-depth explanation of what's in this
                    diagram — pitched at your level.
                  </p>
                  {starterQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      disabled={chatLoading}
                      className="block w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-6 rounded-xl rounded-br-sm bg-primary px-3 py-2 text-xs text-primary-foreground"
                      : "mr-2 rounded-xl rounded-bl-sm bg-muted px-3 py-2 text-xs text-foreground"
                  }
                >
                  {m.role === "assistant" ? (
                    <MathMarkdown className="prose prose-xs max-w-none dark:prose-invert [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                      {m.content}
                    </MathMarkdown>
                  ) : (
                    m.content
                  )}
                </div>
              ))}

              {chatLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="mr-2 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              )}

              {chatError && (
                <p className="text-xs text-destructive">{chatError}</p>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form
              className="flex items-center gap-2 border-t border-border p-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. Why does the arrow point there?"
                className="h-9 text-xs"
                disabled={chatLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={chatLoading || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiagramViewerOverlay;
