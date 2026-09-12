/**
 * ResourceChatPanel — "Ask AI about this document".
 *
 * Docked chat panel inside the DocumentViewerOverlay. On first question it
 * lazily extracts the document's text (via the callback provided by
 * PdfJsViewer) and sends it as context to the existing `ai-tutor` edge
 * function — so the AI genuinely "sees" the paper/book the learner is
 * reading and can explain questions, diagrams-by-description, and methods.
 */
import { useCallback, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiRequest } from "@/studymode/lib/aiClient";
import { logger } from "@/utils/logger";
import type { LibraryResource } from "@/types/academicProfile";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ResourceChatPanelProps {
  resource: LibraryResource;
  /** Lazy text extractor from the PDF viewer (null until doc is ready). */
  getDocumentText: (() => Promise<string>) | null;
  onClose: () => void;
}

/** Cap on document text sent as AI context (chars). */
const DOC_CONTEXT_CAP = 12000;

const SUGGESTIONS = [
  "Explain question 1 step by step",
  "What topics does this paper cover?",
  "Give me hints without the answer",
];

export function ResourceChatPanel({
  resource,
  getDocumentText,
  onClose,
}: ResourceChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const docTextRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  };

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      setError(null);
      setInput("");

      const userMsg: Message = { role: "user", content: trimmed };
      const history = [...messages, userMsg];
      setMessages(history);
      setIsLoading(true);
      scrollToBottom();

      try {
        // Lazily extract document text once (can take a couple of seconds
        // for long papers — only pay that cost when the learner asks).
        if (docTextRef.current === null && getDocumentText) {
          try {
            docTextRef.current = await getDocumentText();
          } catch {
            docTextRef.current = "";
          }
        }
        const docText = (docTextRef.current || "").slice(0, DOC_CONTEXT_CAP);

        const syllabusContext = docText
          ? `The learner is currently reading "${resource.title}" (${
              resource.type === "pastpaper" ? "past exam paper" : "study material"
            }) inside the app and is asking about it. Content of the document (may be truncated):\n\n${docText}`
          : `The learner is currently viewing "${resource.title}" in the app. The document text could not be extracted (it may be a scanned/image PDF) — ask them to describe or type out the part they need help with.`;

        const resp = await aiRequest("tutor", {
          messages: history,
          subject: resource.tags?.subject || resource.category,
          topic: resource.title,
          syllabusContext,
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || "The AI tutor is unavailable right now.");
        }
        if (!resp.body) throw new Error("No response received.");

        // Stream SSE chunks into the last assistant message
        let assistantSoFar = "";
        const upsert = (chunk: string) => {
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
          scrollToBottom();
        };

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;
        while (!done) {
          const { done: rDone, value } = await reader.read();
          if (rDone) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as
                | string
                | undefined;
              if (content) upsert(content);
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }
      } catch (err) {
        logger.error("Resource chat error:", err);
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setMessages((prev) =>
          prev[prev.length - 1]?.role === "user" ? prev.slice(0, -1) : prev,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, getDocumentText, resource],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-primary/10 p-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Ask AI</p>
            <p className="max-w-[180px] truncate text-[10px] text-muted-foreground">
              about this document
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              I can see this document. Ask me to explain a question, check your
              method, or summarise a section.
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-xs text-foreground transition hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-xs text-primary-foreground"
                : "mr-auto max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs text-foreground"
            }
          >
            {m.content}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="mr-auto flex items-center gap-2 rounded-2xl bg-muted px-3 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Reading the document…</span>
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      {/* Input */}
      <form
        className="flex items-center gap-2 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this document…"
          className="h-9 flex-1 rounded-full border border-border bg-muted/40 px-3 text-xs outline-none focus:border-primary"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="sm"
          className="h-9 w-9 rounded-full p-0"
          disabled={isLoading || !input.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
