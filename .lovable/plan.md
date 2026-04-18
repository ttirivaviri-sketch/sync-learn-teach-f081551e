
Yes — the parsing pipeline is unaffected by the proposed fix.

## Why parsing still works

The fix only changes **how pdfjs-dist is loaded by Vite**, not what it does:

1. **`optimizeDeps.exclude: ['pdfjs-dist']`** — tells Vite's dev server to skip pre-bundling pdfjs and load it as native ESM instead. The library's API (`getDocument`, `getPage`, `getTextContent`) is identical.

2. **Switching to `pdfjs-dist/legacy/build/pdf.mjs`** — the legacy build exposes the exact same public API as the main build. The only difference is it doesn't use top-level await internally, which is what's breaking the module script load. Worker behavior, text extraction quality, page handling — all identical.

3. **`pdfExtractor.ts` logic unchanged** — `extractTextFromFile()`, `extractPdfText()`, page markers (`## Page N`), and `chunkText()` stay exactly as they are. They just call into pdfjs through a different entry point.

4. **Downstream untouched** — `DocumentUpload.tsx`, the `parse-document` edge function, `exam_board_meta` storage, and the AI tutor prompt injection are not modified.

## Net effect
- Browser successfully loads the pdfjs module → `extractTextFromFile()` runs → real text + `## Page N` markers go to `parse-document` → topics + exam_board_meta saved → AI tutor uses them.

That's the same flow we built; we're just unblocking the module load.

## Files
- `vite.config.ts` — add `optimizeDeps.exclude: ['pdfjs-dist']`
- `src/studymode/lib/pdfExtractor.ts` — switch import to `pdfjs-dist/legacy/build/pdf.mjs` and matching worker
