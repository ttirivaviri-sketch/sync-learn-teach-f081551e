import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { CurrencyCode } from "@/lib/legal";
import { getRate, formatPrice as fmt, symbol as sym } from "@/lib/fx";

interface CurrencyState {
  currency: CurrencyCode;
  rate: number;
  loading: boolean;
  format: (amountZAR: number) => string;
  symbol: string;
}

export function useCurrency(): CurrencyState {
  const { session } = useAuth();
  const [currency, setCurrency] = useState<CurrencyCode>("ZAR");
  const [rate, setRate] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const uid = session?.user?.id;
      let cur: CurrencyCode = "ZAR";
      if (uid) {
        const { data } = await supabase
          .from("profiles")
          .select("currency")
          .eq("id", uid)
          .maybeSingle() as unknown as { data: { currency: CurrencyCode } | null };
        if (data?.currency) cur = data.currency;
      }
      const r = await getRate("ZAR", cur);
      if (cancelled) return;
      setCurrency(cur);
      setRate(r);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  return {
    currency,
    rate,
    loading,
    symbol: sym(currency),
    format: (amountZAR: number) => fmt(amountZAR, currency, rate),
  };
}
