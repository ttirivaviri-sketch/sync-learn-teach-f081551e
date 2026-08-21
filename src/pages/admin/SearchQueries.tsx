import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ArrowUpDown, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Row {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

type SortKey = keyof Row;
type Dimension = "query" | "page";

const RANGES = [7, 28, 90] as const;

export default function SearchQueries() {
  const [days, setDays] = useState<number>(28);
  const [dimension, setDimension] = useState<Dimension>("query");
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<{ clicks: number; impressions: number; terms: number } | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "clicks", dir: "desc" });

  const load = useCallback(
    async (opts: { refresh?: boolean; site_url?: string } = {}) => {
      opts.refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      const { data, error: fnError } = await supabase.functions.invoke("gsc-search-queries", {
        body: { days, dimension, refresh: opts.refresh === true, site_url: opts.site_url },
      });
      if (fnError) {
        setError(fnError.message || "Could not load search queries");
      } else if (data?.status === "selection_required") {
        setCandidates(data.candidates ?? []);
      } else if (data?.error) {
        setError(String(data.error));
      } else if (data) {
        setCandidates(null);
        setRows(data.rows ?? []);
        setTotals(data.totals ?? null);
        setRefreshedAt(data.refreshed_at ?? null);
        setSiteUrl(data.site_url ?? null);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [days, dimension],
  );

  useEffect(() => {
    document.title = "Search Queries | Admin";
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string" || typeof bv === "string") {
        return sort.dir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      }
      return sort.dir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return copy;
  }, [rows, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  const avgCtr = totals && totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Search queries</h1>
          <p className="text-sm text-muted-foreground">
            What people type on Google before they reach {siteUrl ?? "studysync.co.za"}.
            {refreshedAt && ` Last refreshed ${new Date(refreshedAt).toLocaleString()}.`}
          </p>
        </div>
        <Button onClick={() => load({ refresh: true })} disabled={refreshing} variant="outline">
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={days === r ? "default" : "outline"}
            onClick={() => setDays(r)}
          >
            Last {r} days
          </Button>
        ))}
        <span className="mx-2 h-5 w-px bg-border" aria-hidden />
        {(["query", "page"] as Dimension[]).map((d) => (
          <Button
            key={d}
            size="sm"
            variant={dimension === d ? "default" : "outline"}
            onClick={() => setDimension(d)}
          >
            {d === "query" ? "Search terms" : "Landing pages"}
          </Button>
        ))}
      </div>

      {candidates && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose a Search Console property</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {candidates.map((c) => (
              <Button key={c} variant="outline" size="sm" onClick={() => load({ refresh: true, site_url: c })}>
                {c}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {totals && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Clicks", value: totals.clicks.toLocaleString() },
            { label: "Impressions", value: totals.impressions.toLocaleString() },
            { label: "Average CTR", value: `${avgCtr.toFixed(1)}%` },
          ].map((k) => (
            <Card key={k.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{k.value}</CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            {dimension === "query" ? "Top search terms" : "Top landing pages"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No data cached yet. Click Refresh to pull the latest from Google Search Console.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {([
                      ["key", dimension === "query" ? "Search term" : "Page"],
                      ["clicks", "Clicks"],
                      ["impressions", "Impressions"],
                      ["ctr", "CTR"],
                      ["position", "Avg position"],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <TableHead key={key}>
                        <button
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => toggleSort(key)}
                        >
                          {label}
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="max-w-[380px] truncate font-medium">{r.key}</TableCell>
                      <TableCell>{r.clicks}</TableCell>
                      <TableCell>{r.impressions}</TableCell>
                      <TableCell>{(r.ctr * 100).toFixed(1)}%</TableCell>
                      <TableCell>{r.position.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
