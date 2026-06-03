import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MathMarkdownProps {
  children: string;
  className?: string;
}

/**
 * Normalise AI-emitted math so KaTeX can render it consistently across all
 * StudyMode content (quizzes, flashcards, mock papers, model answers, chat,
 * task content, etc.).
 *
 * Handles:
 *  - LaTeX delimiters: `\( ... \)` → `$ ... $`, `\[ ... \]` → `$$ ... $$`
 *  - Currency symbols ($, R, £, €) followed by digits (protect from being
 *    parsed as math by remark-math, and render via `\text{}` when wrapped)
 *  - Percentages: ensure `%` inside math is escaped as `\%`
 *  - Bare units e.g. `8\text{cm}` outside `$...$`
 *  - Bare LaTeX commands (\frac, \sqrt, ...) outside `$...$`
 */
function normaliseMath(input: string): string {
  if (!input) return '';
  let s = input;

  // 1) Normalise LaTeX-style delimiters to dollar-sign delimiters that
  //    remark-math expects.
  s = s.replace(/\\\((.+?)\\\)/gs, (_m, body) => `$${body.trim()}$`);
  s = s.replace(/\\\[(.+?)\\\]/gs, (_m, body) => `$$${body.trim()}$$`);

  // 2) Protect currency from being misread as a math delimiter.
  //    An *unescaped* lone `$` followed by digits and no closing `$` on the
  //    same line is currency, not math.  Escape it to `\$`.
  s = s.replace(/(^|[^\\$])\$(\d[\d,]*(?:\.\d+)?)(?!\s*[^\n$]*\$)/g,
    (_m, pre, num) => `${pre}\\$${num}`);

  // 3) Wrap bare quantities-with-units like `8\text{cm}` so KaTeX renders them.
  s = s.replace(/(\d+(?:\.\d+)?)\\text\{([^}]+)\}/g,
    (_m, num, unit) => `$${num}\\,\\text{${unit}}$`);

  // 4) Wrap standalone LaTeX commands that aren't already inside $...$.
  const latexCmd = /\\(frac|sqrt|sum|int|lim|text|cdot|times|div|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|theta|pi|sigma|omega|mu|lambda|rightarrow|leftarrow|Rightarrow)\b/;
  s = s.replace(/([^\n$]*?)(?=\n|$)/g, (segment) => {
    if (!segment || segment.includes('$')) return segment;
    if (!latexCmd.test(segment)) return segment;
    return segment.replace(
      /([A-Za-z0-9.,()\s]*\\(?:frac|sqrt|sum|int|lim|text|cdot|times|div|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|theta|pi|sigma|omega|mu|lambda|rightarrow|leftarrow|Rightarrow)[^\s.,;:!?]*(?:\{[^}]*\})*)/g,
      (m) => `$${m.trim()}$`,
    );
  });

  // 5) Inside math spans, ensure `%` is escaped as `\%` (otherwise KaTeX
  //    treats it as a comment and silently drops the rest of the math).
  s = s.replace(/\$([^$\n]+?)\$/g, (_m, body) => {
    const fixed = body.replace(/(?<!\\)%/g, '\\%');
    return `$${fixed}$`;
  });
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_m, body) => {
    const fixed = body.replace(/(?<!\\)%/g, '\\%');
    return `$$${fixed}$$`;
  });

  return s;
}

/**
 * Markdown renderer with LaTeX math support for all StudyMode content.
 * Inline math: $x^2$ or \(x^2\)
 * Display math: $$\frac{a}{b}$$ or \[\frac{a}{b}\]
 * Currency `$120`, percentages `50%`, and units `8 cm` are also handled.
 */
export function MathMarkdown({ children, className }: MathMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {normaliseMath(children ?? '')}
      </ReactMarkdown>
    </div>
  );
}
