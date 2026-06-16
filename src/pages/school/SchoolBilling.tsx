/**
 * School admin Billing & Status page.
 *
 * Shows contract state (trial / active / expiring / expired / suspended),
 * seat and storage/AI usage relative to plan caps, and the next billing
 * milestone (renewal or trial end). Read-only — billing changes are
 * handled by the StudySync team via the mailto link.
 */
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Mail, ShieldAlert, CalendarClock, Users, Database, Brain, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BillingTimeline from "@/components/school/BillingTimeline";
import type { School } from "@/hooks/useSchools";
import {
  evaluateSchoolContract, contractMessage, BILLING_CONTACT_EMAIL, type ContractGate,
} from "@/lib/schoolContract";

type Ctx = { school: School; role: string; contractGate: ContractGate };

const STATE_TONE: Record<ContractGate["state"], string> = {
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  trial: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  expiring_soon: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  expired: "bg-destructive/15 text-destructive border-destructive/30",
  suspended: "bg-destructive/15 text-destructive border-destructive/30",
  archived: "bg-muted text-muted-foreground border-muted-foreground/30",
  not_started: "bg-muted text-muted-foreground border-muted-foreground/30",
};

export default function SchoolBilling() {
  const { schoolId } = useParams();
  const { school, role, contractGate } = useOutletContext<Ctx>();
  const isAdmin = role === "school_admin";

  const usage = useUsage(schoolId, school);

  if (!isAdmin) {
    return (
      <Card className="mx-auto mt-8 max-w-md p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h2 className="mb-1 text-lg font-semibold">Restricted area</h2>
        <p className="text-sm text-muted-foreground">
          Only school admins can view billing & status.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to={`/school/${schoolId}`}>Back to dashboard</Link>
        </Button>
      </Card>
    );
  }

  const msg = contractMessage(contractGate);
  const nextDate = nextMilestone(school, contractGate);
  const mailto = `mailto:${BILLING_CONTACT_EMAIL}?subject=${encodeURIComponent(`Billing — ${school.name}`)}`;

  return (
    <section className="space-y-4 max-w-4xl">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Billing & status
          </h1>
          <p className="text-sm text-muted-foreground">{school.name} · plan {school.plan ?? "—"}</p>
        </div>
        <Badge variant="outline" className={STATE_TONE[contractGate.state]}>{msg.title}</Badge>
      </header>

      <Card className="p-5 space-y-3">
        <p className="text-sm">{msg.body}</p>
        {nextDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            <span>{nextDate.label}: <strong className="text-foreground">{nextDate.value}</strong></span>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm"><a href={mailto}><Mail className="h-4 w-4 mr-1" /> Contact billing</a></Button>
          <Button asChild size="sm" variant="outline"><Link to={`/school/${schoolId}/settings`}>School settings</Link></Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <QuotaCard
          icon={<Users className="h-4 w-4" />}
          label="Teacher seats"
          used={usage.data?.teachers ?? 0}
          limit={school.seats_teachers ?? 0}
          loading={usage.isLoading}
        />
        <QuotaCard
          icon={<Users className="h-4 w-4" />}
          label="Student seats"
          used={usage.data?.students ?? 0}
          limit={school.seats_students ?? 0}
          loading={usage.isLoading}
        />
        <QuotaCard
          icon={<Brain className="h-4 w-4" />}
          label="AI requests today"
          used={usage.data?.aiToday ?? 0}
          limit={school.ai_quota_daily ?? 0}
          loading={usage.isLoading}
          unit=""
        />
        <QuotaCard
          icon={<Database className="h-4 w-4" />}
          label="Storage"
          used={usage.data?.storageMb ?? 0}
          limit={school.storage_quota_mb ?? 0}
          loading={usage.isLoading}
          unit=" MB"
        />
      </div>

      <Card className="p-5">
        <h2 className="font-medium mb-3">Contract details</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Plan" value={school.plan ?? "—"} />
          <Stat label="Status" value={school.status} />
          <Stat label="Contract start" value={fmtDate(school.contract_start)} />
          <Stat label="Contract end" value={fmtDate(school.contract_end)} />
        </dl>
      </Card>

      <BillingTimeline school={school} />
    </section>
  );
}

function QuotaCard({ icon, label, used, limit, loading, unit = "" }: {
  icon: React.ReactNode; label: string; used: number; limit: number; loading?: boolean; unit?: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 90 ? "text-destructive" : pct >= 75 ? "text-amber-600" : "text-muted-foreground";
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      <div className="text-lg font-semibold">{used}{unit}<span className="text-sm text-muted-foreground"> / {limit || "∞"}{limit ? unit : ""}</span></div>
      {limit > 0 && <Progress value={pct} className="h-1.5" />}
      {limit > 0 && <p className={`text-[11px] ${tone}`}>{pct}% of plan</p>}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString() : "—"; }

function nextMilestone(school: School, gate: ContractGate): { label: string; value: string } | null {
  if (gate.state === "trial" && school.contract_end)
    return { label: "Trial ends", value: new Date(school.contract_end).toLocaleDateString() };
  if ((gate.state === "active" || gate.state === "expiring_soon") && school.contract_end)
    return { label: "Next renewal", value: new Date(school.contract_end).toLocaleDateString() };
  if (gate.state === "not_started")
    return { label: "Access opens", value: new Date(gate.startsAt).toLocaleDateString() };
  if (gate.state === "expired")
    return { label: "Contract ended", value: new Date(gate.endedAt).toLocaleDateString() };
  return null;
}

/** Live counts: teachers, students, today's AI requests, total storage MB. */
function useUsage(schoolId: string | undefined, school: School) {
  return useQuery({
    enabled: !!schoolId,
    queryKey: ["school-billing-usage", schoolId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: members }, { data: ai }, { data: res }] = await Promise.all([
        supabase.from("school_memberships").select("role,status").eq("school_id", schoolId!).eq("status", "active"),
        supabase.from("school_ai_usage_daily").select("requests").eq("school_id", schoolId!).eq("usage_date", today),
        supabase.from("school_resources").select("size_bytes").eq("school_id", schoolId!),
      ]);
      const teachers = (members ?? []).filter((m: { role: string }) => m.role === "school_teacher" || m.role === "school_admin").length;
      const students = (members ?? []).filter((m: { role: string }) => m.role === "school_student").length;
      const aiToday = (ai ?? []).reduce((s, r: { requests: number | null }) => s + (r.requests ?? 0), 0);
      const storageMb = Math.round(((res ?? []).reduce((s, r: { size_bytes: number | null }) => s + (r.size_bytes ?? 0), 0)) / (1024 * 1024));
      void school;
      return { teachers, students, aiToday, storageMb };
    },
    staleTime: 60_000,
  });
}
