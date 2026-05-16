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

  // DB
  const { data } = await supabase
    .from("fx_rates" as never)
    .select("rate")
    .eq("base", base)
    .eq("quote", quote)
    .maybeSingle() as unknown as { data: { rate: number } | null };

  const rate = data?.rate ?? 1;
  const entry = { rate, at: Date.now() };
  cache.set(key, entry);
  try { localStorage.setItem(`fx:${key}`, JSON.stringify(entry)); } catch {/* ignore */}
  return rate;
}

export function symbol(c: CurrencyCode): string { return SYMBOLS[c] || c; }

export function formatPrice(amountZAR: number, currency: CurrencyCode, rate = 1): string {
  const converted = amountZAR * rate;
  const sym = symbol(currency);
  return `${sym}${converted.toFixed(currency === "ZAR" ? 0 : 2)}`;
}
