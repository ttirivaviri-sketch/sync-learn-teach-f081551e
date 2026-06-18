/**
 * Shared validator for library_system_resources seed rows.
 *
 * Catches schema/type mismatches BEFORE rows hit the DB trigger:
 * - kind=video must have a video_url that matches a known video host
 * - non-video kinds must have a pdf_url
 * - a video-looking URL in pdf_url is auto-fixed (moved to video_url, kind=video)
 *
 * The DB has the same rules enforced via trigger + CHECK constraint;
 * this helper exists so seeders fail fast with a useful per-row message.
 */

import { z } from "https://esm.sh/zod@3.23.8";

export const ALLOWED_KINDS = ["textbook", "past_paper", "syllabus", "video", "guide"] as const;
export type LibraryKind = (typeof ALLOWED_KINDS)[number];

export const VIDEO_URL_RE =
  /(youtube\.com|youtu\.be|vimeo\.com|loom\.com|\.(mp4|webm|mov|m4v)(\?|$))/i;

export const LibraryRowSchema = z.object({
  title: z.string().min(1),
  kind: z.enum(ALLOWED_KINDS),
  curriculum: z.string().min(1),
  subject: z.string().min(1),
  topic: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  pdf_url: z.string().url().nullable().optional(),
  video_url: z.string().url().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  grade_levels: z.array(z.string()).default([]),
  pages: z.number().int().positive().nullable().optional(),
});

export type LibraryRowInput = z.input<typeof LibraryRowSchema>;
export type LibraryRow = z.infer<typeof LibraryRowSchema>;

export interface ValidationResult {
  ok: boolean;
  row?: LibraryRow;
  error?: string;
}

/** Validate + normalise a single library row. */
export function validateLibraryRow(input: LibraryRowInput): ValidationResult {
  const parsed = LibraryRowSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const row = { ...parsed.data };

  // Auto-fix: video URL accidentally placed in pdf_url
  if (row.pdf_url && VIDEO_URL_RE.test(row.pdf_url)) {
    row.video_url = row.video_url ?? row.pdf_url;
    row.pdf_url = null;
    row.kind = "video";
  }

  if (row.video_url) row.kind = "video";

  if (row.kind === "video") {
    if (!row.video_url) return { ok: false, error: "kind=video requires video_url" };
    if (!VIDEO_URL_RE.test(row.video_url)) {
      return { ok: false, error: `video_url does not match a known video host: ${row.video_url}` };
    }
    if (!row.grade_levels || row.grade_levels.length === 0) {
      row.grade_levels = ["8", "9", "10", "11", "12"];
    }
  } else {
    if (!row.pdf_url) return { ok: false, error: `kind=${row.kind} requires pdf_url` };
  }

  return { ok: true, row };
}

/** Validate a batch; returns valid rows and a list of errors. */
export function validateLibraryBatch(rows: LibraryRowInput[]): {
  valid: LibraryRow[];
  errors: { index: number; title?: string; error: string }[];
} {
  const valid: LibraryRow[] = [];
  const errors: { index: number; title?: string; error: string }[] = [];
  rows.forEach((r, i) => {
    const res = validateLibraryRow(r);
    if (res.ok && res.row) valid.push(res.row);
    else errors.push({ index: i, title: (r as { title?: string }).title, error: res.error ?? "unknown" });
  });
  return { valid, errors };
}
