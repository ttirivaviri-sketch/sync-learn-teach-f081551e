/**
 * Billing timeline for SchoolBilling.
 *
 * Combines past contract milestones (created, started, ended) with
 * recorded contract_state_changed audit entries so admins can see a
 * single chronological history of their school's billing posture.
 */
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CircleDot, CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { School } from "@/hooks/useSchools";
import { evaluateSchoolContract, contractMessage } from "@/lib/schoolContract";

interface AuditRow {
  id: string;
  action: string;
  created_at: string;
  diff: Record<string, unknown> | null;
}

interface TimelineItem {
  key: string;
  at: string;
  title: string;
  body?: string;
  tone: "past" | "now" | "future" | "warn";
}

export default function BillingTimeline({ school }: { school: School }) {
  const { data: audits, isLoading } = useQuery({
    queryKey: ["school-billing-audits", school.id],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase
        .from("school_audit_logs")
        .select("id,action,created_at,diff")
        .eq("school_id", school.id)
        .in("action", ["contract_state_changed", "school_updated", "school_created"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
    staleTime: 60_000,
  });

  const gate = evaluateSchoolContract(school);
  const msg = contractMessage(gate);
  const now = new Date();

  const items: TimelineItem[] = [];

  // Milestones from school fields
  if (school.created_at) items.push({
    key: "created", at: school.created_at, title: "School created", tone: "past",
  });
  if (school.contract_start) {
    const d = new Date(school.contract_start);
    items.push({
      key: "start",
      at: school.contract_start,
      title: d > now ? "Contract starts" : "Contract started",
      body: `Plan ${school.plan ?? "—"}`,
      tone: d > now ? "future" : "past",
    });
  }
  if (school.contract_end) {
    const d = new Date(school.contract_end);
    const isFuture = d > now;
    items.push({
      key: "end",
      at: school.contract_end,
      title: isFuture ? (school.status === "trial" ? "Trial ends" : "Next renewal") : "Contract ended",
      body: isFuture ? "Renew before this date to avoid losing access." : "Renew to restore access.",
      tone: isFuture ? (gate.state === "expiring_soon" ? "warn" : "future") : "warn",
    });
  }

  // Current state marker
  items.push({
    key: "now",
    at: new Date().toISOString(),
    title: `Now — ${msg.title}`,
    body: msg.body,
    tone: gate.state === "expiring_soon" || gate.state === "expired" || gate.state === "suspended" ? "warn" : "now",
  });

  // Audit history
  for (const a of audits ?? []) {
    const diff = (a.diff ?? {}) as Record<string, unknown>;
    const fromS = diff.from ?? diff.previous_status;
    const toS = diff.to ?? diff.new_status ?? diff.status;
    items.push({
      key: a.id,
      at: a.created_at,
      title: a.action === "contract_state_changed"
        ? `Status changed${fromS && toS ? `: ${fromS} → ${toS}` : ""}`
        : a.action.replaceAll("_", " "),
      body: typeof diff.reason === "string" ? diff.reason : undefined,
      tone: "past",
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <Card className="p-5">
      <header className="flex items-center justify-between mb-3">
        <h2 className="font-medium flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Billing timeline</h2>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </header>
      <ol className="relative border-l border-border/60 ml-2 space-y-4">
        {items.map((it) => (
          <li key={it.key} className="pl-4 relative">
            <span className="absolute -left-[7px] top-1">
              {it.tone === "warn" ? <AlertTriangle className="h-3 w-3 text-amber-600" />
                : it.tone === "now" ? <CircleDot className="h-3 w-3 text-primary" />
                : it.tone === "future" ? <CalendarClock className="h-3 w-3 text-muted-foreground" />
                : <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
            </span>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <p className="text-sm font-medium">{it.title}</p>
              <span className="text-[11px] text-muted-foreground">{new Date(it.at).toLocaleString()}</span>
            </div>
            {it.body && <p className="text-xs text-muted-foreground mt-0.5">{it.body}</p>}
            {it.tone === "now" && (
              <Badge variant="outline" className="mt-1 text-[10px]">current</Badge>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="pl-4 text-sm text-muted-foreground">No billing history yet.</li>
        )}
      </ol>
    </Card>
  );
}
