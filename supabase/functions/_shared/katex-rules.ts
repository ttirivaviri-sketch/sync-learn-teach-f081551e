/**
 * Canonical KaTeX/LaTeX rendering rules shared by every StudyMode generator
 * prompt. Keep these tight — the model copies them verbatim into output, so
 * any ambiguity here becomes a rendering bug in the app.
 *
 * Consumed by: generate-quiz, generate-flashcards, generate-exam-questions,
 * generate-mock-paper, generate-prerequisite-quiz, generate-task-content,
 * generate-topic-session, generate-concept-review,
 * generate-prerequisite-theory, explain-answer, ai-tutor, grade-answer,
 * process-lesson-recording.
 */
export const KATEX_RULES = `MATHEMATICAL & QUANTITATIVE NOTATION (STRICT — rendered by KaTeX):
- ALL maths MUST use LaTeX wrapped in $...$ (inline) or $$...$$ (display).
- NEVER write plain x^2, x_1, sqrt(x), a/b — always $x^2$, $x_1$, $\\sqrt{x}$, $\\frac{a}{b}$.
- Greek letters, arrows, comparisons: $\\alpha$, $\\rightarrow$, $\\leq$, $\\geq$, $\\neq$, $\\approx$.
- Ranges & ratios: $3:4$, $5\\leq x\\leq 10$.

PERCENTAGES (STRICT):
- ALWAYS wrap in math and escape the percent sign: $50\\%$, $12.5\\%$, $100\\%$.
- NEVER write a bare 50% or "50 percent" — it MUST be $50\\%$.

CURRENCIES (STRICT — escape every currency symbol):
- USD: $\\$120$, $\\$1{,}500.00$
- ZAR (Rand): $R\\,250$, $R\\,1{,}200.50$
- GBP: $\\pounds 10$
- EUR: $\\euro 5$
- NGN/Naira: $\\text{₦}500$
- Always thin-space ($\\,$) between symbol and number when the symbol is a letter (R, K, etc.).

QUANTITIES WITH UNITS (STRICT — number + \\, + \\text{unit}):
- SI lengths: $8\\,\\text{cm}$, $1.5\\,\\text{m}$, $250\\,\\text{km}$, $4\\,\\text{mm}$.
- SI mass: $1.5\\,\\text{kg}$, $250\\,\\text{g}$, $40\\,\\text{mg}$, $2\\,\\text{t}$.
- Time: $30\\,\\text{s}$, $45\\,\\text{min}$, $2\\,\\text{h}$.
- Temperature: $25\\,\\text{°C}$, $298\\,\\text{K}$.
- Physics derived: $5\\,\\text{N}$, $200\\,\\text{J}$, $60\\,\\text{W}$, $101{,}325\\,\\text{Pa}$, $12\\,\\text{V}$, $2\\,\\text{A}$, $5\\,\\Omega$, $50\\,\\text{Hz}$.
- Speed/acceleration: $20\\,\\text{m/s}$, $9.8\\,\\text{m/s}^2$.
- Density / per-unit: $\\text{kg/m}^3$, $\\text{g/cm}^3$, $\\text{mol/L}$, $\\text{km/h}$ — write per-unit as $\\text{X/Y}$, NEVER plain X/Y.
- Chemistry: $0.5\\,\\text{mol/L}$, $25\\,\\mu\\text{g}$, $200\\,\\text{ppm}$, $1\\,\\text{atm}$, $250\\,\\text{mL}$, $1.5\\,\\text{L}$.
- Angles: $45^\\circ$, $\\theta = 30^\\circ$.
- NEVER write a bare "5kg", "5 kg", "9.8 m/s^2" — it MUST be a math span with a thin space and \\text{unit}.

GENERAL:
- Wrap ONLY the quantitative span, not the whole sentence: "The block weighs $1.5\\,\\text{kg}$ and falls at $9.8\\,\\text{m/s}^2$."
- For compound units always use \\text{} and ^ for powers: $\\text{kg}\\cdot\\text{m/s}^2$, NEVER kg.m/s2.`;
