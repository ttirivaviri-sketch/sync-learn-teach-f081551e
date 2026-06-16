/**
 * School admin Audit Logs page.
 *
 * Lists every audit event recorded against the school in
 * `public.school_audit_logs`. Defaults to contract-gate denials but
 * can be filtered by action, feature, user role, and date range.
 */
import { useMemo, useState } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollText, ShieldAlert, Loader2, Filter, RotateCcw } from "lucide-react";
import type { School } from "@/hooks/useSchools";
import type { ContractGate } from "@/lib/schoolContract";

type Ctx = { school: School; role: string; contractGate: ContractGate };

interface AuditRow {
  id: string;
  school_id: string;
  actor_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_OPTIONS = [
  { value: "all", label: "All actions" },
  { value: "contract_gate_denied", label: "Contract gate denials" },
  { value: "contract_state_changed", label: "Contract state changes" },
];

export default function SchoolAuditLogs() {
  const { schoolId } = useParams();
  const { role } = useOutletContext<Ctx>();
  const isAdmin = role === "school_admin";

  const [action, setAction] = useState<string>("contract_gate_denied");
  const [feature, setFeature] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [from, setFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const query = useQuery({
    enabled: !!schoolId && isAdmin,
    queryKey: ["school-audit-logs", schoolId, action, from, to],
    queryFn: async (): Promise<AuditRow[]> => {
      let q = supabase
        .from("school_audit_logs")
        .select("id,school_id,actor_id,action,target_table,target_id,diff,created_at")
        .eq("school_id", schoolId!)
        .gte("created_at", `${from}T00:00:00.000Z`)
        .lte("created_at", `${to}T23:59:59.999Z`)
        .order("created_at", { ascending: false })
        .limit(500);
      if (action !== "all") q = q.eq("action", action);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const rows = query.data ?? [];

  const filtered = useMemo(() => rows.filter((r) => {
    const d = (r.diff ?? {}) as Record<string, unknown>;
    if (feature !== "all" && String(d.feature ?? "") !== feature) return false;
    if (roleFilter !== "all" && String(d.role ?? "") !== roleFilter) return false;
    return true;
  }), [rows, feature, roleFilter]);

  const featureOptions = useMemo(() => uniq(rows.map((r) => String((r.diff as Record<string, unknown> | null)?.feature ?? "")).filter(Boolean)), [rows]);
  const roleOptions = useMemo(() => uniq(rows.map((r) => String((r.diff as Record<string, unknown> | null)?.role ?? "")).filter(Boolean)), [rows]);

  if (!isAdmin) {
    return (
      <Card className="mx-auto mt-8 max-w-md p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h2 className="mb-1 text-lg font-semibold">Restricted area</h2>
        <p className="text-sm text-muted-foreground">Only school admins can view audit logs.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to={`/school/${schoolId}`}>Back to dashboard</Link>
        </Button>
      </Card>
    );
  }

  return (
    <section className="space-y-4 max-w-5xl">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <ScrollText className="h-5 w-5" /> Audit logs
          </h1>
          <p className="text-sm text-muted-foreground">Contract-gate denials and other governance events for this school.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          <RotateCcw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </header>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <Filter className="h-4 w-4 text-muted-foreground mb-2.5" />
          <Field label="Action">
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Feature">
            <Select value={feature} onValueChange={setFeature}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All features</SelectItem>
                {featureOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="User role">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </Field>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {query.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading audit log…
          </div>
        ) : query.isError ? (
          <div className="p-6 text-sm text-destructive">Failed to load audit log.</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No events match the current filters.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Feature</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-20 text-right">Code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const d = (r.diff ?? {}) as Record<string, unknown>;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.action}</Badge></TableCell>
                    <TableCell className="text-xs">{String(d.feature ?? "—")}</TableCell>
                    <TableCell className="text-xs">{String(d.role ?? "—")}</TableCell>
                    <TableCell className="text-xs max-w-md truncate" title={String(d.reason ?? "")}>
                      {String(d.reason ?? "—")}
                    </TableCell>
                    <TableCell className="text-right text-xs">{String(d.code ?? d.status ?? "")}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">Showing up to 500 most recent rows in the selected date range.</p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

function uniq(xs: string[]): string[] {
  return Array.from(new Set(xs)).sort();
}
