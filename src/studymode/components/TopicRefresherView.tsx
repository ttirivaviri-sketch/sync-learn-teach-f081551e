/**
 * TopicRefresherView
 *
 * Structured renderer for micro-revision ("Topic Refresher") AI content.
 * Splits the generated markdown (## Topic Refresher / ## Quick Review
 * Questions / ## Exam Tip) into visually distinct cards per the UI spec:
 *   - "In short" summary card
 *   - Individual Q&A cards under a QUICK REVIEW QUESTIONS label
 *   - A pulled-out amber Exam Tip callout
 *
 * If the content doesn't match the expected shape, callers should fall
 * back to prose rendering (check `parseRefresherContent(...).ok`).
 */

import { Lightbulb, Star } from 'lucide-react';
import { MathMarkdown } from './MathMarkdown';

export interface ParsedRefresher {
  summary: string;
  questions: { q: string; a: string }[];
  examTip: string;
  ok: boolean;
}

export function parseRefresherContent(md: string): ParsedRefresher {
  const result: ParsedRefresher = { summary: '', questions: [], examTip: '', ok: false };
  if (!md?.trim()) return result;

  const sections = md.split(/^##\s+/m);
  for (const sec of sections) {
    const nl = sec.indexOf('\n');
    const heading = (nl === -1 ? sec : sec.slice(0, nl)).trim().toLowerCase();
    const body = (nl === -1 ? '' : sec.slice(nl + 1)).trim();
    if (!heading) continue;

    if (heading.includes('refresher') || heading.includes('in short') || heading.includes('summary')) {
      result.summary = body;
    } else if (heading.includes('exam tip') || heading.includes('tip')) {
      result.examTip = body;
    } else if (heading.includes('question') || heading.includes('review')) {
      const items = body.split(/^\s*\d+[.)]\s+/m).map((s) => s.trim()).filter(Boolean);
      for (const item of items) {
        const parts = item.split(/\*\*Answer:?\*\*:?/i);
        const q = parts[0]?.trim() ?? '';
        const a = parts.slice(1).join(' ').trim();
        if (q) result.questions.push({ q, a });
      }
    }
  }

  result.ok = Boolean(result.summary || result.questions.length || result.examTip);
  return result;
}

interface TopicRefresherViewProps {
  parsed: ParsedRefresher;
  isLoading?: boolean;
}

export function TopicRefresherView({ parsed, isLoading }: TopicRefresherViewProps) {
  return (
    <div className={isLoading ? 'space-y-4 animate-pulse' : 'space-y-4'}>
      {/* In short — summary card */}
      {parsed.summary && (
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">In short</span>
          </div>
          <div className="text-sm text-foreground/90 [&_p]:my-1">
            <MathMarkdown>{parsed.summary}</MathMarkdown>
          </div>
        </div>
      )}

      {/* Individual Q&A cards */}
      {parsed.questions.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Quick review questions
          </p>
          {parsed.questions.map((qa, i) => (
            <div key={i} className="p-4 rounded-xl bg-card border border-border space-y-1.5">
              <div className="text-sm font-medium text-foreground [&_p]:my-0 [&_strong]:text-primary">
                <MathMarkdown>{qa.q}</MathMarkdown>
              </div>
              {qa.a && (
                <div className="text-sm text-muted-foreground [&_p]:my-0">
                  <MathMarkdown>{qa.a}</MathMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Exam tip callout */}
      {parsed.examTip && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Star className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">Exam tip</span>
          </div>
          <div className="text-sm text-amber-900/90 dark:text-amber-100/90 [&_p]:my-0">
            <MathMarkdown>{parsed.examTip}</MathMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
