/**
 * PDF & DOCX text extraction for the upload pipeline.
 *
 * Uses pdfjs-dist to extract real text from PDFs (page by page, preserving
 * page boundaries with `## Page N` markers so the edge function can chunk
 * sensibly). Falls back to `file.text()` for plain-text uploads.
 */

import * as pdfjsLib from "pdfjs-dist";
// Use the bundled worker via Vite's ?url import so it loads from the same origin.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite worker URL
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");

  if (isPdf) {
    return extractPdfText(file);
  }

  // DOCX / TXT / fallback — use plain text. DOCX bytes will be partly
  // garbled but still better than nothing for now.
  return file.text();
}

async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const pages: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const text = (content.items as Array<{ str?: string }>)
        .map((item) => item.str ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push(`## Page ${pageNum}\n${text}`);
    } catch {
      pages.push(`## Page ${pageNum}\n[unreadable]`);
    }
  }

  await pdf.destroy();
  return pages.join("\n\n");
}

/**
 * Split extracted text into chunks of approximately `maxChars` size,
 * splitting on page boundaries (`## Page N`) when possible so the AI
 * extractor sees coherent sections.
 */
export function chunkText(text: string, maxChars = 80_000): string[] {
  if (text.length <= maxChars) return [text];

  const pages = text.split(/(?=## Page \d+)/g);
  const chunks: string[] = [];
  let current = "";

  for (const page of pages) {
    if (current.length + page.length > maxChars && current) {
      chunks.push(current);
      current = page;
    } else {
      current += page;
    }
  }
  if (current) chunks.push(current);

  // Hard cap chunks to avoid runaway uploads
  return chunks.slice(0, 4);
}
