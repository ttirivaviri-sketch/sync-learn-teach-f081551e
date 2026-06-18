/**
 * Lightweight image colour analysis used by the school-branding flow.
 *
 *   extractDominantColor(file) → hex
 *   themeFromBrandColor(hex)   → { primaryHsl, accentHsl, ringHsl, mode }
 *   applySchoolTheme(el, hex)  → sets CSS variables on the element
 *
 * We avoid an extra dependency by doing the colour quantisation in-canvas.
 * Pixels are bucketed by (h, s, l) — keeping saturated mid-tones over washed
 * neutrals so a logo's "brand" colour wins over the white background it sits
 * on. Returns "#3B82F6" as a safe fallback.
 */

const FALLBACK_HEX = "#3B82F6";

export type HSL = { h: number; s: number; l: number };

export function hexToHsl(hex: string): HSL {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m) return { h: 217, s: 91, l: 60 };
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => n.toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/**
 * Quantise pixels and pick the bucket with the highest "brand weight":
 * count × saturation × mid-lightness preference. This biases the result
 * toward bold logo strokes and away from white/black surrounding areas.
 */
export async function extractDominantColor(source: File | string): Promise<string> {
  const img = await loadImage(source);
  const W = 64; // small canvas → fast, plenty of accuracy for a logo
  const H = Math.max(1, Math.round((img.height / img.width) * W));
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return FALLBACK_HEX;
  ctx.drawImage(img, 0, 0, W, H);
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, W, H);
  } catch {
    return FALLBACK_HEX; // tainted cross-origin canvas
  }

  const buckets = new Map<string, { r: number; g: number; b: number; count: number; weight: number }>();
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2], a = data.data[i + 3];
    if (a < 200) continue; // skip transparent
    // skip near-white and near-black
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max > 245 && min > 240) continue;
    if (max < 20) continue;
    // bucket to 5-bit channels
    const key = `${r >> 3}-${g >> 3}-${b >> 3}`;
    const sat = max === 0 ? 0 : (max - min) / max;
    const lightness = (max + min) / 510;
    const midBias = 1 - Math.abs(0.5 - lightness) * 1.4;
    const weight = sat * 1.2 + Math.max(0, midBias) * 0.4;
    const entry = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0, weight: 0 };
    entry.r += r; entry.g += g; entry.b += b;
    entry.count += 1;
    entry.weight += weight;
    buckets.set(key, entry);
  }

  let best: { r: number; g: number; b: number; score: number } | null = null;
  for (const v of buckets.values()) {
    const score = v.weight * Math.log2(v.count + 1);
    if (!best || score > best.score) {
      best = { r: v.r / v.count, g: v.g / v.count, b: v.b / v.count, score };
    }
  }
  if (!best) return FALLBACK_HEX;
  return rgbToHex(Math.round(best.r), Math.round(best.g), Math.round(best.b));
}

function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    if (typeof source === "string") {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = () => { img.src = String(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    }
  });
}

/**
 * Derive a coherent theme triplet from a brand colour. Lightness is pinned
 * to a readable range so a very dark or very pale logo still produces an
 * accessible primary on both light and dark surfaces.
 */
export function themeFromBrandColor(hex: string) {
  const { h, s } = hexToHsl(hex);
  const sat = Math.min(95, Math.max(45, s));
  return {
    primaryHsl: `${h} ${sat}% 52%`,
    accentHsl: `${(h + 18) % 360} ${Math.min(90, sat)}% 60%`,
    ringHsl: `${h} ${sat}% 52%`,
  };
}

/** Apply theme as CSS variables on an element (use the SchoolLayout root). */
export function applySchoolTheme(el: HTMLElement | null, hex: string | null | undefined) {
  if (!el) return;
  if (!hex) {
    el.style.removeProperty("--primary");
    el.style.removeProperty("--ring");
    el.style.removeProperty("--accent");
    return;
  }
  const t = themeFromBrandColor(hex);
  el.style.setProperty("--primary", t.primaryHsl);
  el.style.setProperty("--ring", t.ringHsl);
  el.style.setProperty("--accent", t.accentHsl);
}
