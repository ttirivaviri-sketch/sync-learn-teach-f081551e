import { useState, useCallback } from 'react';
import { Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface AIProgressInsightsProps {
  subjects: Array<{ name: string; currentTopic: string; mastery: number }>;
  dailyStats: { tasksCompletedToday: number; totalTasksToday: number; examQuestionsToday: number; xpToday: number };
  streak: number;
  xp: number;
  quizHistory: Array<{ topic_name: string; accuracy: number; total_attempts: number; due_for_review: boolean }>;
  masteryData: Array<{ name: string; current: number; change: number }>;
}

export function AIProgressInsights({ subjects, dailyStats, streak, xp, quizHistory, masteryData }: AIProgressInsightsProps) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateInsights = useCallback(async () => {
    setIsLoading(true);
    setContent('');
    setError(null);

    try {
      const resp = await fetch('/api/ai/progress-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjects, dailyStats, streak, xp, quizHistory, masteryData }),
        });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: 'Failed to generate insights' }));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setContent(accumulated);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Flush remaining
      if (buffer.trim()) {
        for (const raw of buffer.split('\n')) {
          if (!raw || !raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setContent(accumulated);
            }
          } catch { /* ignore */ }
        }
      }

      setHasGenerated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [subjects, dailyStats, streak, xp, quizHistory, masteryData]);

  if (!hasGenerated && !isLoading && !content) {
    return (
      <div className="p-5 rounded-2xl bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-accent" />
          <h3 className="font-bold text-foreground">AI Study Coach</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Get personalized study recommendations based on your performance data.
        </p>
        <Button onClick={generateInsights} className="gap-2 gradient-primary">
          <Sparkles className="h-4 w-4" />
          Get AI Insights
        </Button>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h3 className="font-bold text-foreground">AI Study Coach</h3>
        </div>
        {hasGenerated && !isLoading && (
          <Button variant="ghost" size="sm" onClick={generateInsights} className="gap-1 text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        )}
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={generateInsights}>Retry</Button>
        </div>
      ) : content ? (
        <div className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "[&_blockquote]:border-l-accent [&_blockquote]:bg-accent/5 [&_blockquote]:rounded-r-lg",
          isLoading && "animate-pulse"
        )}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      ) : (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Analyzing your performance...</p>
        </div>
      )}
    </div>
  );
}
