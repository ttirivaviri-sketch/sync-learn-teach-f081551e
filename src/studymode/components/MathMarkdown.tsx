import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MathMarkdownProps {
  children: string;
  className?: string;
}

/**
 * Known unit tokens that should be wrapped in $...$ when the AI emits a bare
 * "5 kg" outside a math span. Order matters — multi-char/compound units MUST
 * come before their single-letter prefixes (e.g. "mol/L" before "L").
 */
const UNIT_TOKENS = [
  // Compound / per-unit (most specific first)
  'kg/m\\^?3', 'g/cm\\^?3', 'mol/L', 'km/h', 'm/s\\^?2', 'm/s',
  // Chemistry
  'mol', 'mL', '\\u03bcg', 'ug', 'ppm', 'atm',
  // Physics derived
  'Hz', 'Pa', '\\u03a9', 'Ohm',
  // SI base (longer first so 'min' beats 'm' and 'mm' beats 'm')
  'min', 'mm', 'cm', 'km', 'mg', 'kg', '°C', '\\u00b0C',
  // Single letters (last)
  'm', 'g', 's', 'h', 'L', 'N', 'J', 'W', 'V', 'A', 'K', 't',
];

const UNIT_RX = new RegExp(
  `(?<![\\w$\\\\])(\\d+(?:\\.\\d+)?)\\s?(${UNIT_TOKENS.join('|')})\\b`,
  'g',
);

/**
 * Normalise AI-emitted math so KaTeX can render it consistently across all
 * StudyMode content. Handles delimiters, currencies, percentages, per-unit
 * notation and bare quantity-with-unit fragments.
 */
function normaliseMath(input: string): string {
  if (!input) return '';
  let s = input;

  // 1) LaTeX-style delimiters → dollar-sign delimiters.
  s = s.replace(/\\\((.+?)\\\)/gs, (_m, body) => `$${body.trim()}$`);
  s = s.replace(/\\\[(.+?)\\\]/gs, (_m, body) => `$$${body.trim()}$$`);

  // 2) Escape lone currency $ followed by digits (currency, not math).
  s = s.replace(
    /(^|[^\\$])\$(\d[\d,]*(?:\.\d+)?)(?!\s*[^\n$]*\$)/g,
    (_m, pre, num) => `${pre}\\$${num}`,
  );

  // 3) Wrap quantities-with-\text{} units already containing the macro.
  s = s.replace(
    /(\d+(?:\.\d+)?)\\text\{([^}]+)\}/g,
    (_m, num, unit) => `$${num}\\,\\text{${unit}}$`,
  );

  // 4) Wrap bare "5 kg" / "9.8 m/s^2" etc. outside math spans.
  s = s
    .split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g)
    .map((part) => {
      if (part.startsWith('$')) return part;
      return part.replace(UNIT_RX, (_m, num, unit) => {
        const cleanUnit = unit.replace(/\^/g, '^');
        return `$${num}\\,\\text{${cleanUnit}}$`;
      });
    })
    .join('');

  // 5) Wrap bare percentages: "50%" → "$50\%$".
  s = s
    .split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g)
    .map((part) => {
      if (part.startsWith('$')) return part;
      return part.replace(
        /(?<![\w\\])(\d+(?:\.\d+)?)\s?%/g,
        (_m, num) => `$${num}\\%$`,
      );
    })
    .join('');

  // 6) Standalone LaTeX commands outside $...$ → wrap in math.
  const latexCmd =
    /\\(frac|sqrt|sum|int|lim|text|cdot|times|div|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|theta|pi|sigma|omega|mu|lambda|Omega|rightarrow|leftarrow|Rightarrow|pounds|euro)\b/;
  s = s.replace(/([^\n$]*?)(?=\n|$)/g, (segment) => {
    if (!segment || segment.includes('$')) return segment;
    if (!latexCmd.test(segment)) return segment;
    return segment.replace(
      /([A-Za-z0-9.,()\s]*\\(?:frac|sqrt|sum|int|lim|text|cdot|times|div|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|theta|pi|sigma|omega|mu|lambda|Omega|rightarrow|leftarrow|Rightarrow|pounds|euro)[^\s.,;:!?]*(?:\{[^}]*\})*)/g,
      (m) => `$${m.trim()}$`,
    );
  });

  // 7) Inside math spans: escape unescaped %, ensure thin space between number and \text{}.
  const fixInside = (body: string) =>
    body
      .replace(/(?<!\\)%/g, '\\%')
      .replace(/(\d)\\text\{/g, '$1\\,\\text{');

  s = s.replace(/\$([^$\n]+?)\$/g, (_m, body) => `$${fixInside(body)}$`);
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_m, body) => `$$${fixInside(body)}$$`);

  return s;
}

/**
 * Markdown renderer with LaTeX math support for all StudyMode content.
 * Inline math: $x^2$ or \(x^2\)
 * Display math: $$\frac{a}{b}$$ or \[\frac{a}{b}\]
 * Currency `$120`, percentages `50%`, and units `8 cm` are auto-formatted.
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
