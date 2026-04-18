
## Diagnosis

Quiz/exam questions are text+LaTeX only. Curricula like Maths (graphs of $y = x^2 - 4$), Physics (circuits, ray diagrams), Biology (cells, organs), and Geography (contours, climate graphs) routinely require visuals. Today the AI sometimes *describes* a diagram in words ("a circuit with a 12V battery and two resistors in series") instead of rendering one, which makes the question unanswerable in past-paper style.

## Approach

Add a **structured `visual` field** to every generated question. The AI decides per-question whether a visual is needed and which kind, then returns a spec the client renders deterministically. For diagrams that can't be cleanly described as data (biology cells, ray diagrams, geography sketches), fall back to **AI image generation** (Nano Banana via Lovable AI Gateway) prompted to mirror real past-paper style. No live internet image scraping — it's unreliable, slow, and copyright-risky; AI image generation grounded with a past-paper style description gives equivalent results.

### Visual spec schema
```ts
visual?: {
  type: 'function-graph' | 'data-chart' | 'svg-diagram' | 'ai-image';
  required: boolean;       // must student see it to answer?
  caption?: string;        // "Figure 1: Cross-section of a leaf"
  
  // type='function-graph' (Maths):
  functions?: { expression: string; color?: string; domain?: [number, number] }[];
  xRange?: [number, number]; yRange?: [number, number];
  gridlines?: boolean; points?: { x: number; y: number; label?: string }[];
  
  // type='data-chart' (Geography climate, Physics V-I, etc.):
  chartKind?: 'bar' | 'line' | 'scatter';
  data?: { x: number|string; y: number; series?: string }[];
  xLabel?: string; yLabel?: string;
  
  // type='svg-diagram' (simple physics: circuits, forces, ray diagrams):
  svg?: string;            // raw inline SVG the AI authors directly
  
  // type='ai-image' (biology, complex geography, anatomy):
  imagePrompt?: string;    // detailed prompt mirroring past-paper style
  imageUrl?: string;       // populated by edge function after generation
}
```

### Backend changes
1. **`generate-quiz` & `generate-exam-questions`** — extend system prompt:
   - Add a "VISUALS" section: "If this curriculum/topic typically includes a diagram or graph (check syllabus + past-paper exemplars), populate the `visual` field. Pick the right `type`. For Maths use `function-graph`. For data interpretation use `data-chart`. For simple labeled diagrams (circuits, force diagrams, ray diagrams) author inline SVG. For biological/anatomical/geographic illustrations use `ai-image` with a detailed `imagePrompt` describing past-paper style (black-and-white line art, labeled parts, exam-style)."
   - Past-paper exemplars from `get_subject_context` already contain `concepts_tested`/`question_type` — pass a `hasVisualInPastPaper` hint when exemplars mention figures.

2. **New edge function `render-question-visual`** — for `type='ai-image'`, calls Nano Banana (`google/gemini-2.5-flash-image`) with the AI-authored `imagePrompt`, uploads the resulting PNG to a new public storage bucket `question-diagrams`, returns the public URL. Called lazily from the client when a question with `type='ai-image'` is shown (so we don't burn image-gen credits on every quiz).

3. **New storage bucket** `question-diagrams` (public, image MIME types only) for cached generated diagrams.

### Frontend changes
1. **New component `QuestionVisual.tsx`** — renders the `visual` spec:
   - `function-graph`: lightweight SVG plotter (already have recharts; use a small custom plotter for arbitrary expressions — parse with `mathjs` which is in the bundle area or add it).
   - `data-chart`: recharts (already installed).
   - `svg-diagram`: sanitize and render the inline SVG via `dangerouslySetInnerHTML` after running through DOMPurify (already a dep) with SVG profile.
   - `ai-image`: shows skeleton, calls `render-question-visual` once, caches URL in question state, renders `<img>` with caption.

2. **`ExamQuestionPanel.tsx`** — render `<QuestionVisual visual={quizGenerator.question.visual} />` directly under the question text and above the analysis form.

3. **`useQuizGenerator.ts`** — pass through the new `visual` field in the returned `QuizQuestion` type.

### Security / performance
- DOMPurify with SVG config strips `<script>`, event handlers, external refs.
- AI-image generation gated to `type='ai-image'` only (~ 1 in 5 questions), and cached in storage by hash of `imagePrompt` so re-shown questions don't re-bill.
- All image URLs served from Supabase storage public bucket.

### Files
- `supabase/functions/generate-quiz/index.ts` (edit: extend prompt + schema)
- `supabase/functions/generate-exam-questions/index.ts` (edit: same)
- `supabase/functions/render-question-visual/index.ts` (new)
- new public storage bucket `question-diagrams` (migration)
- `src/studymode/components/QuestionVisual.tsx` (new)
- `src/studymode/hooks/useQuizGenerator.ts` (edit: add `visual` field)
- `src/studymode/components/ExamQuestionPanel.tsx` (edit: render visual)

### Result
- Maths: $y = x^2 - 4x + 3$ → AI returns `function-graph` spec → real plotted parabola with axes/gridlines.
- Physics circuit: AI authors inline SVG with battery, resistors, ammeter — rendered exactly like a past-paper figure.
- Biology "label the parts of the heart": AI returns `ai-image` with prompt `"Black-and-white labeled diagram of the human heart, A-Level biology past paper style, four chambers labeled A–D, line art on white background"` → Nano Banana generates → cached image displayed.
- Geography climate graph: `data-chart` with bars (rainfall) + line (temp) overlay.
- AI omits the `visual` field for pure-text questions, so nothing changes for those.
