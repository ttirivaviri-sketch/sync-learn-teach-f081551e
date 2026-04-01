import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Sparkles, Trash2, BookOpen } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { useAITutor } from '../hooks/useAITutor';
import { useSyllabusContext } from '../hooks/useSyllabusContext';
import { cn } from '../lib/utils';
import { MathMarkdown } from './MathMarkdown';

interface ChatPanelProps {
  subject?: string;
  subjectId?: string;
  topic?: string;
  className?: string;
}

export function ChatPanel({ subject, subjectId, topic, className }: ChatPanelProps) {
  const [input, setInput] = useState('');

  // Fetch curriculum context so the tutor can give topic-specific answers
  const { curriculumContext, isLoaded: contextLoaded } = useSyllabusContext(subjectId, topic);

  // Build a concise tutor system context from the curriculum data
  const syllabusContext = curriculumContext
    ? `\n\nCURRICULUM CONTEXT FOR THIS SESSION:\n${curriculumContext.substring(0, 2000)}`
    : '';

  const { messages, isLoading, error, sendMessage, clearMessages } = useAITutor({ subject, topic, syllabusContext });
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevContextRef = useRef({ subject, topic });

  // Clear messages when subject/topic context changes
  useEffect(() => {
    const prevContext = prevContextRef.current;
    if (prevContext.subject !== subject || prevContext.topic !== topic) {
      clearMessages();
      prevContextRef.current = { subject, topic };
    }
  }, [subject, topic, clearMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const suggestedQuestions = [
    "Explain this concept in simple terms",
    "What are the key points I need to remember?",
    "Can you give me an example?",
    "How would this appear in an exam?",
  ];

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-r from-accent to-primary">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">AI Tutor</h3>
            {subject && (
              <p className="text-xs text-muted-foreground">
                {subject}{topic ? ` • ${topic}` : ''}
                {curriculumContext && (
                  <span className="ml-1 text-accent inline-flex items-center gap-0.5">
                    <BookOpen className="h-2.5 w-2.5" /> syllabus loaded
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            className="text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="p-3 rounded-full bg-accent/10 mb-4">
              <Bot className="h-8 w-8 text-accent" />
            </div>
            <h4 className="font-semibold text-foreground mb-2">Ask me anything!</h4>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              I'm here to help you understand concepts, solve problems, and prepare for exams.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-full text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-accent to-primary flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5",
                    msg.role === 'user'
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-foreground"
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-accent to-primary flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-secondary rounded-2xl px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-card/50">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="shrink-0 h-11 w-11"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
