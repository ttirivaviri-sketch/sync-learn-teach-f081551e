import { supabase } from "@/integrations/supabase/client";
import type { CurrencyCode } from "./legal";

const SYMBOLS: Record<CurrencyCode, string> = { ZAR: "R", USD: "$", GBP: "£" };

const cache = new Map<string, { rate: number; at: number }>();
const TTL = 24 * 60 * 60 * 1000;

export async function getRate(base: string, quote: string): Promise<number> {
  if (base === quote) return 1;
  const key = `${base}->${quote}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.rate;

  // Try localStorage
  try {
    const raw = localStorage.getItem(`fx:${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.at < TTL) {
        cache.set(key, parsed);
        return parsed.rate;
      }
    }
  } catch {/* ignore */}

  // Live mid-market rate (free, no key). Falls back to the DB table below.
  let rate: number | null = null;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`);
    if (res.ok) {
      const json = await res.json();
      const live = json?.rates?.[quote];
      if (typeof live === "number" && Number.isFinite(live) && live > 0) rate = live;
    }
  } catch {/* offline — fall through to DB */}

  if (rate === null) {
    const { data } = await supabase
      .from("fx_rates" as never)
      .select("rate")
      .eq("base", base)
      .eq("quote", quote)
      .maybeSingle() as unknown as { data: { rate: number } | null };
    rate = data?.rate ?? null;
  }

  if (rate === null) return 1;
  const entry = { rate, at: Date.now() };
  cache.set(key, entry);
  try { localStorage.setItem(`fx:${key}`, JSON.stringify(entry)); } catch {/* ignore */}
  return rate;
}

/** React hook: live ZAR→currency rate with graceful fallback. */
export function useFxRate(base: string, quote: string) {
  const [rate, setRate] = useStateSafe(base === quote ? 1 : null);
  useEffectSafe(() => {
    let alive = true;
    if (base === quote) { setRate(1); return () => { alive = false; }; }
    getRate(base, quote).then((r) => { if (alive) setRate(r); });
    return () => { alive = false; };
  }, [base, quote]);
  return rate;
}

export function symbol(c: CurrencyCode): string { return SYMBOLS[c] || c; }

export function formatPrice(amountZAR: number, currency: CurrencyCode, rate = 1): string {
  const converted = amountZAR * rate;
  const sym = symbol(currency);
  return `${sym}${converted.toFixed(currency === "ZAR" ? 0 : 2)}`;
}
