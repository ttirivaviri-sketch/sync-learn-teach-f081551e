import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const RANGES = [7, 28, 90] as const;

export type EnquiryStatus = "new" | "in_progress" | "answered" | "cancelled";

const STATUSES: { value: EnquiryStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "answered", label: "Answered" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_VARIANTS: Record<EnquiryStatus, "default" | "secondary" | "outline"> = {
  new: "default",
  in_progress: "secondary",
  answered: "outline",
  cancelled: "outline",
};

interface Enquiry {
  id: string;
  created_at: string;
  path: string | null;
  referrer: string | null;
  session_id: string;
  channel: string;
  subject: string;
  sessionType: string;
  source: string | null;
  label: string | null;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  instagram: "Instagram",
  phone: "Phone call",
  booking: "Booking button",
  signup: "Free trial signup",
};

function countBy(rows: Enquiry[], pick: (r: Enquiry) => string) {
  const map = new Map<string, number>();
  rows.forEach((r) => {
    const key = pick(r) || "unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export default function Enquiries() {
  const [days, setDays] = useState<number>(28);
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [statuses, setStatuses] = useState<Record<string, EnquiryStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | EnquiryStatus>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { refresh?: boolean } = {}) => {
      opts.refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error: qError } = await supabase
        .from("landing_events")
        .select("id, created_at, path, referrer, session_id, metadata")
        .eq("event", "cta_click")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (qError) {
        setError(qError.message || "Could not load enquiries");
      } else {
        const mapped: Enquiry[] = (data ?? [])
          .map((row) => {
            const meta = (row.metadata ?? {}) as Record<string, unknown>;
            return {
              id: row.id,
              created_at: row.created_at,
              path: row.path,
              referrer: row.referrer,
              session_id: row.session_id,
              intent: String(meta.intent ?? ""),
              channel: String(meta.channel ?? "unknown"),
              subject: String(meta.subject ?? "general"),
              sessionType: String(meta.session_type ?? "unspecified"),
              source: meta.source ? String(meta.source) : null,
              label: meta.label ? String(meta.label) : null,
            };
          })
          .filter((r) => r.intent === "tutor_enquiry")
          .map(({ intent: _intent, ...rest }) => rest);
        setRows(mapped);

        if (mapped.length) {
          const { data: statusRows } = await supabase
            .from("enquiry_status")
            .select("event_id, status")
            .in(
              "event_id",
              mapped.map((r) => r.id),
            );
          const map: Record<string, EnquiryStatus> = {};
          (statusRows ?? []).forEach((s) => {
            map[s.event_id] = s.status as EnquiryStatus;
          });
          setStatuses(map);
        } else {
          setStatuses({});
        }
      }
      setLoading(false);
      setRefreshing(false);
    },
    [days],
  );

  useEffect(() => {
    document.title = "Tutor Enquiries | Admin";
    void load();
  }, [load]);

  const bySubject = useMemo(() => countBy(rows, (r) => r.subject), [rows]);
  const byChannel = useMemo(() => countBy(rows, (r) => r.channel), [rows]);
  const byPage = useMemo(() => countBy(rows, (r) => r.path ?? "unknown"), [rows]);
  const uniqueVisitors = useMemo(
    () => new Set(rows.map((r) => r.session_id)).size,
    [rows],
  );

  const statusOf = useCallback(
    (id: string): EnquiryStatus => statuses[id] ?? "new",
    [statuses],
  );

  const openCount = useMemo(
    () => rows.filter((r) => statusOf(r.id) === "new").length,
    [rows, statusOf],
  );

  const visibleRows = useMemo(
    () =>
      statusFilter === "all"
        ? rows
        : rows.filter((r) => statusOf(r.id) === statusFilter),
    [rows, statusFilter, statusOf],
  );

  const updateStatus = useCallback(
    async (id: string, status: EnquiryStatus) => {
      const previous = statuses[id];
      setSavingId(id);
      setStatuses((s) => ({ ...s, [id]: status }));
      const { data: auth } = await supabase.auth.getUser();
      const { error: upsertError } = await supabase
        .from("enquiry_status")
        .upsert(
          {
            event_id: id,
            status,
            updated_by: auth.user?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "event_id" },
        );
      setSavingId(null);
      if (upsertError) {
        setStatuses((s) => {
          const next = { ...s };
          if (previous) next[id] = previous;
          else delete next[id];
          return next;
        });
        toast.error(upsertError.message || "Could not update the status");
      } else {
        toast.success(
          `Marked as ${STATUSES.find((s) => s.value === status)?.label.toLowerCase()}`,
        );
      }
    },
    [statuses],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tutor enquiries</h1>
          <p className="text-sm text-muted-foreground">
            Every time a visitor taps WhatsApp, email, phone or a booking button — with the
            subject and page they were on.
          </p>
        </div>
        <Button onClick={() => load({ refresh: true })} disabled={refreshing} variant="outline">
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
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
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading enquiries…
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No enquiries in the last {days} days</p>
            <p className="max-w-md text-sm text-muted-foreground">
              As soon as visitors tap WhatsApp, email, phone or a “book a tutor” button, they
              will show up here with the subject and page they came from.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Enquiries
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{rows.length}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Visitors
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{uniqueVisitors}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Top subject
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold capitalize">
                {bySubject[0]?.[0] ?? "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Favourite way to reach you
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {byChannel[0] ? CHANNEL_LABELS[byChannel[0][0]] ?? byChannel[0][0] : "—"}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {[
              { title: "By subject", data: bySubject, fmt: (k: string) => k },
              {
                title: "By channel",
                data: byChannel,
                fmt: (k: string) => CHANNEL_LABELS[k] ?? k,
              },
              { title: "By page", data: byPage, fmt: (k: string) => k },
            ].map((group) => (
              <Card key={group.title}>
                <CardHeader>
                  <CardTitle className="text-base">{group.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.data.slice(0, 8).map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{group.fmt(key)}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent enquiries</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Button</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{CHANNEL_LABELS[r.channel] ?? r.channel}</TableCell>
                      <TableCell className="capitalize">{r.subject}</TableCell>
                      <TableCell className="capitalize">{r.sessionType}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.path ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.label ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
