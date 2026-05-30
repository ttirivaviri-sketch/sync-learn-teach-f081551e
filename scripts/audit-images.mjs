#!/usr/bin/env node
/**
 * Image audit — prevents oversized assets from being committed.
 *
 * Scans src/assets and public/ for raster images, prints a size report,
 * and exits non-zero if any image exceeds the configured budget.
 *
 * Run locally:   node scripts/audit-images.mjs
 * Run in CI:     npm run audit:images   (see package.json scripts)
 */
import { readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src/assets", "public"];
const RASTER_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]);

// Per-file budget (bytes). Tune as needed.
const DEFAULT_MAX = 300 * 1024; // 300 KB
// Allow-list for files we accept being larger (with reason).
const ALLOW = [
  // Brand logo: locked transparent PNG, lossless-only compression allowed.
  { path: "public/lovable-uploads/studysync-logo.png", max: 2_000_000 },
  // PWA / social icon: ~350 KB after pngquant.
  { path: "public/lovable-uploads/b660f842-9169-416b-826d-c9006528e365.png", max: 400_000 },
];

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (RASTER_EXT.has(extname(name).toLowerCase())) {
      out.push({ path: relative(ROOT, full), size: st.size });
    }
  }
  return out;
}

const allowMap = new Map(ALLOW.map((a) => [a.path, a.max]));
const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))).sort((a, b) => b.size - a.size);

const offenders = [];
for (const f of files) {
  const budget = allowMap.get(f.path) ?? DEFAULT_MAX;
  if (f.size > budget) offenders.push({ ...f, budget });
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`Scanned ${files.length} images across ${SCAN_DIRS.join(", ")}`);
console.log(`Top 10 largest:`);
for (const f of files.slice(0, 10)) console.log(`  ${kb(f.size).padStart(10)}  ${f.path}`);

if (offenders.length) {
  console.error(`\n✗ ${offenders.length} image(s) exceed budget:`);
  for (const f of offenders) {
    console.error(`  ${kb(f.size)} > ${kb(f.budget)}  ${f.path}`);
  }
  console.error(
    `\nConvert PNG/JPEG to WebP/AVIF, or add an entry to ALLOW in scripts/audit-images.mjs with a reason.`,
  );
  process.exit(1);
}
console.log(`\n✓ All images within budget (default ${kb(DEFAULT_MAX)}).`);
