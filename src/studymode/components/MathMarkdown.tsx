import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MathMarkdownProps {
  children: string;
  className?: string;
}

/**
 * Normalise AI-emitted math so KaTeX can render it.
 * Handles common cases where the model returns bare LaTeX commands
 * (e.g. `8\text{cm}`, `\frac{1}{2}`, `\$120`) outside of `$...$` delimiters.
 */
function normaliseMath(input: string): string {
  if (!input) return '';
  let s = input;

  // Unescape currency: `\$120` → `$120` (but not `\$$` math delimiters)
  s = s.replace(/\\\$/g, '$');

  // Wrap bare \text{...} that follows a number or letter, e.g. `8\text{cm}` → `$8\text{cm}$`
  s = s.replace(/(\d+(?:\.\d+)?)\\text\{([^}]+)\}/g, '$$$1\\,\\text{$2}$$');

  // Wrap standalone LaTeX commands that aren't already inside $...$
  // Detect lines/segments containing \frac, \sqrt, \sum, \int, ^{}, _{} etc. without $
  const latexCmd = /\\(frac|sqrt|sum|int|lim|text|cdot|times|div|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|theta|pi|sigma|omega|mu|lambda)\b/;
  s = s.replace(/([^\n$]*?)(?=\n|$)/g, (segment) => {
    if (!segment || segment.includes('$')) return segment;
    if (!latexCmd.test(segment)) return segment;
    // Wrap the smallest contiguous LaTeX-bearing run
    return segment.replace(
      /([A-Za-z0-9.,()\s]*\\(?:frac|sqrt|sum|int|lim|text|cdot|times|div|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|theta|pi|sigma|omega|mu|lambda)[^\s.,;:!?]*(?:\{[^}]*\})*)/g,
      (m) => `$${m.trim()}$`,
    );
  });

  return s;
}

/**
 * Markdown renderer with LaTeX math support.
 * Inline math: $x^2$ or \(x^2\)
 * Display math: $$\frac{a}{b}$$ or \[\frac{a}{b}\]
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
