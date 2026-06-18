import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, CreditCard, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpdateSchool, type School } from "@/hooks/useSchools";
import { evaluateSchoolContract, contractMessage, BILLING_CONTACT_EMAIL, type ContractGate } from "@/lib/schoolContract";
import { SchoolLogoUploader } from "@/components/school/SchoolLogoUploader";

export default function SchoolSettings() {
  const { school } = useOutletContext<{ school: School }>();
  const { toast } = useToast();
  const update = useUpdateSchool();
  const [form, setForm] = useState<any>(school);
  useEffect(() => setForm(school), [school]);

  const save = async () => {
    try {
      await update.mutateAsync({
        id: school.id,
        patch: {
          contact_person: form.contact_person, contact_email: form.contact_email,
          contact_phone: form.contact_phone, address: form.address,
          brand_color: form.brand_color, country: form.country, school_type: form.school_type,
        },
      });
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <section className="space-y-4 max-w-3xl">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">School settings</h1>
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
        </Button>
      </header>
      <Card className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label>School type</Label><Input value={form.school_type ?? ""} onChange={(e) => setForm({ ...form, school_type: e.target.value })} /></div>
        <div><Label>Country</Label><Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
        <div><Label>Brand colour</Label><Input value={form.brand_color ?? ""} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} placeholder="#3B82F6" /></div>
        <div><Label>Contact person</Label><Input value={form.contact_person ?? ""} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
        <div><Label>Contact email</Label><Input type="email" value={form.contact_email ?? ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
        <div><Label>Contact phone</Label><Input value={form.contact_phone ?? ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Address</Label><Textarea rows={2} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
      </Card>
      <BillingCard school={school} />
    </section>
  );
}

function BillingCard({ school }: { school: School }) {
  const gate: ContractGate = evaluateSchoolContract(school);
  const msg = contractMessage(gate);
  const stateColor: Record<ContractGate["state"], string> = {
    active: "bg-emerald-500/15 text-emerald-700",
    trial: "bg-blue-500/15 text-blue-700",
    expiring_soon: "bg-amber-500/15 text-amber-700",
    expired: "bg-destructive/15 text-destructive",
    suspended: "bg-destructive/15 text-destructive",
    archived: "bg-muted text-muted-foreground",
    not_started: "bg-muted text-muted-foreground",
  };
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");
  const subject = encodeURIComponent(`Billing — ${school.name}`);

  return (
    <Card className="p-5 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Plan & billing</h2>
        </div>
        <Badge className={stateColor[gate.state] + " border-0"}>{msg.title}</Badge>
      </header>

      <p className="text-sm text-muted-foreground">{msg.body}</p>

      <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <Stat label="Plan" value={school.plan} />
        <Stat label="Status" value={school.status} />
        <Stat label="Teacher seats" value={String(school.seats_teachers ?? 0)} />
        <Stat label="Student seats" value={String(school.seats_students ?? 0)} />
        <Stat label="AI quota / day" value={String(school.ai_quota_daily ?? 0)} />
        <Stat label="Storage cap" value={`${school.storage_quota_mb ?? 0} MB`} />
        <Stat label="Contract start" value={fmt(school.contract_start)} />
        <Stat label="Contract end" value={fmt(school.contract_end)} />
      </dl>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild size="sm">
          <a href={`mailto:${BILLING_CONTACT_EMAIL}?subject=${subject}`}>
            <Mail className="h-4 w-4 mr-1" /> Contact billing
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={`mailto:${BILLING_CONTACT_EMAIL}?subject=${encodeURIComponent(`Upgrade plan — ${school.name}`)}`}>
            Request upgrade
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Plan, seats, AI quota and contract dates are managed by StudySync. Email billing to make changes.
      </p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium capitalize">{value}</dd>
    </div>
  );
}
