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
      <Card className="p-5">
        <h2 className="font-medium mb-2">Plan & seats</h2>
        <p className="text-sm text-muted-foreground">
          Plan <strong>{school.plan}</strong> · Status <strong>{school.status}</strong> ·
          {" "}{school.seats_teachers} teacher seats · {school.seats_students} student seats.
        </p>
        <p className="text-xs text-muted-foreground mt-2">Contact StudySync to change your plan or seat allocations.</p>
      </Card>
    </section>
  );
}
