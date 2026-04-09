import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';

interface MathMarkdownProps {
  children: string;
  className?: string;
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
        {children}
      </ReactMarkdown>
    </div>
  );
}
