/**
 * useAiUsage — reads the signed-in user's own AI consumption from
 * `ai_usage_daily` (RLS scopes rows to auth.uid()).
 *
 * Returns today's per-bucket usage with the remaining allowance for the
 * caller's plan, plus a day-by-day history for the recent window.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { AI_BUCKET_ORDER, aiBucketLimit } from "@/lib/aiQuotas";

export interface AiUsageRow {
  usage_date: string;
  bucket: string;
  requests: number;
  tokens_in: number;
  tokens_out: number;
  updated_at: string;
}

export interface AiBucketUsage {
  bucket: string;
  used: number;
  limit: number;
  remaining: number;
  percent: number;
}

export interface AiUsageDay {
  date: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  buckets: { bucket: string; requests: number }[];
}

const HISTORY_DAYS = 14;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function useAiUsage() {
  const { isPremium } = useSubscription();
  const premium = isPremium();

  const query = useQuery({
    queryKey: ["ai-usage", HISTORY_DAYS],
    queryFn: async (): Promise<AiUsageRow[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const since = new Date();
      since.setDate(since.getDate() - (HISTORY_DAYS - 1));

      const { data, error } = await supabase
        .from("ai_usage_daily")
        .select("usage_date, bucket, requests, tokens_in, tokens_out, updated_at")
        .eq("user_id", user.id)
        .gte("usage_date", isoDate(since))
        .order("usage_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as AiUsageRow[];
    },
    staleTime: 60_000,
  });

  const rows = query.data ?? [];
  const today = isoDate(new Date());

  const todayRows = rows.filter((r) => r.usage_date === today);

  const buckets: AiBucketUsage[] = AI_BUCKET_ORDER.map((bucket) => {
    const used = todayRows
      .filter((r) => r.bucket === bucket)
      .reduce((sum, r) => sum + (r.requests ?? 0), 0);
    const limit = aiBucketLimit(bucket, premium);
    return {
      bucket,
      used,
      limit,
      remaining: Math.max(limit - used, 0),
      percent: limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0,
    };
  });

  const byDay = new Map<string, AiUsageDay>();
  for (const r of rows) {
    const entry =
      byDay.get(r.usage_date) ??
      { date: r.usage_date, requests: 0, tokensIn: 0, tokensOut: 0, buckets: [] };
    entry.requests += r.requests ?? 0;
    entry.tokensIn += r.tokens_in ?? 0;
    entry.tokensOut += r.tokens_out ?? 0;
    entry.buckets.push({ bucket: r.bucket, requests: r.requests ?? 0 });
    byDay.set(r.usage_date, entry);
  }
  const history = Array.from(byDay.values())
    .map((d) => ({ ...d, buckets: d.buckets.sort((a, b) => b.requests - a.requests) }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalToday = todayRows.reduce((s, r) => s + (r.requests ?? 0), 0);
  const totalRemaining = buckets.reduce((s, b) => s + b.remaining, 0);
  const totalAllowance = buckets.reduce((s, b) => s + b.limit, 0);

  return {
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
    isPremium: premium,
    buckets,
    history,
    totalToday,
    totalRemaining,
    totalAllowance,
    historyDays: HISTORY_DAYS,
  };
}
