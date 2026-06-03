/**
 * Canonical KaTeX/LaTeX rendering rules shared by every StudyMode generator
 * prompt. Keep these tight — the model copies them verbatim into output, so
 * any ambiguity here becomes a rendering bug in the app.
 *
 * Consumed by: generate-quiz, generate-flashcards, generate-exam-questions,
 * generate-mock-paper, generate-prerequisite-quiz, generate-task-content,
 * generate-topic-session, generate-concept-review,
 * generate-prerequisite-theory, explain-answer, ai-tutor, grade-answer.
 */
export const KATEX_RULES = `MATHEMATICAL & QUANTITATIVE NOTATION (STRICT — rendered by KaTeX):
- ALL maths MUST use LaTeX wrapped in $...$ (inline) or $$...$$ (display).
- NEVER write plain x^2, x_1, sqrt(x), a/b — always $x^2$, $x_1$, $\\sqrt{x}$, $\\frac{a}{b}$.
- Percentages: write $50\\%$, $12.5\\%$ (the % MUST be escaped with a backslash inside math).
- Currencies: write $\\$120$, $R\\,250$, $\\pounds 10$, $\\euro 5$ (escape the dollar sign).
- Quantities with units: write $8\\,\\text{cm}$, $9.8\\,\\text{m/s}^2$, $25\\,\\text{°C}$.
- Ranges & ratios: $3:4$, $5\\leq x\\leq 10$.
- Greek letters, arrows, comparisons: $\\alpha$, $\\rightarrow$, $\\leq$, $\\geq$, $\\neq$, $\\approx$.
- Never wrap an entire sentence in $...$. Wrap only the quantitative span.`;
