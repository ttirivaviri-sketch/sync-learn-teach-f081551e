/**
 * Super admin: detail / edit / member & invitation management for one school.
 */
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Save, UserPlus, Mail, Trash2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useSchool, useUpdateSchool, useSchoolMemberships, useSchoolInvitations,
  useCreateInvitation, useRevokeInvitation, useUpdateMembership,
  type SchoolPlan, type SchoolStatus, type SchoolRole,
} from "@/hooks/useSchools";

const roleLabel: Record<SchoolRole, string> = {
  school_admin: "Admin",
  school_teacher: "Teacher",
  school_student: "Student",
};

export default function AdminSchoolDetail() {
  const { id = "" } = useParams();
  const { toast } = useToast();
  const { data: school, isLoading } = useSchool(id);
  const update = useUpdateSchool();

  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (school) setForm({ ...school }); }, [school]);

  if (isLoading || !school || !form) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>;
  }

  const save = async () => {
    try {
      await update.mutateAsync({
        id: school.id,
        patch: {
          name: form.name, contact_person: form.contact_person, contact_email: form.contact_email,
          contact_phone: form.contact_phone, country: form.country, school_type: form.school_type,
          address: form.address, brand_color: form.brand_color,
          status: form.status, plan: form.plan,
          seats_teachers: Number(form.seats_teachers) || 0,
          seats_students: Number(form.seats_students) || 0,
          ai_quota_daily: Number(form.ai_quota_daily) || 0,
          storage_quota_mb: Number(form.storage_quota_mb) || 0,
          contract_start: form.contract_start, contract_end: form.contract_end,
        },
      });
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <section className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <Link to="/admin/schools" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> All schools
        </Link>
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-semibold">{school.name}</h1>
        <p className="text-sm text-muted-foreground">/{school.slug}</p>
      </header>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <Card className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as SchoolStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plan</Label>
              <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v as SchoolPlan })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>School type</Label><Input value={form.school_type ?? ""} onChange={(e) => setForm({ ...form, school_type: e.target.value })} placeholder="primary / secondary / college" /></div>
            <div><Label>Country</Label><Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
            <div><Label>Brand colour</Label><Input value={form.brand_color ?? ""} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} placeholder="#3B82F6" /></div>
            <div className="md:col-span-2"><Label>Address</Label><Textarea rows={2} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Contact person</Label><Input value={form.contact_person ?? ""} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div><Label>Contact email</Label><Input type="email" value={form.contact_email ?? ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div><Label>Contact phone</Label><Input value={form.contact_phone ?? ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
          </Card>

          <Card className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><Label>Teacher seats</Label><Input type="number" min={0} value={form.seats_teachers} onChange={(e) => setForm({ ...form, seats_teachers: e.target.value })} /></div>
            <div><Label>Student seats</Label><Input type="number" min={0} value={form.seats_students} onChange={(e) => setForm({ ...form, seats_students: e.target.value })} /></div>
            <div><Label>Daily AI quota</Label><Input type="number" min={0} value={form.ai_quota_daily} onChange={(e) => setForm({ ...form, ai_quota_daily: e.target.value })} /></div>
            <div><Label>Storage (MB)</Label><Input type="number" min={0} value={form.storage_quota_mb} onChange={(e) => setForm({ ...form, storage_quota_mb: e.target.value })} /></div>
            <div><Label>Contract start</Label><Input type="date" value={form.contract_start ?? ""} onChange={(e) => setForm({ ...form, contract_start: e.target.value || null })} /></div>
            <div><Label>Contract end</Label><Input type="date" value={form.contract_end ?? ""} onChange={(e) => setForm({ ...form, contract_end: e.target.value || null })} /></div>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4"><MembersPanel schoolId={school.id} /></TabsContent>
        <TabsContent value="invitations" className="mt-4"><InvitationsPanel schoolId={school.id} /></TabsContent>
      </Tabs>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Members panel (reused inside super-admin and school-admin contexts)
// ─────────────────────────────────────────────────────────────────────────────
export function MembersPanel({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const list = useSchoolMemberships(schoolId);
  const update = useUpdateMembership();

  const remove = async (id: string) => {
    if (!confirm("Remove this member from the school?")) return;
    try {
      await update.mutateAsync({ id, patch: { status: "removed" } });
      toast({ title: "Member removed" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  if (list.isLoading) return <div className="text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Loading…</div>;
  if (!list.data?.length) return <Card className="p-8 text-center text-muted-foreground">No members yet — send an invitation.</Card>;

  return (
    <Card className="divide-y">
      {list.data.map((m) => (
        <div key={m.id} className="p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{m.profile?.full_name || m.profile?.email || m.invited_email || "Unknown"}</span>
              <Badge variant="outline">{roleLabel[m.role]}</Badge>
              {m.status !== "active" && <Badge variant="secondary">{m.status}</Badge>}
            </div>
            {m.profile?.email && <p className="text-xs text-muted-foreground">{m.profile.email}</p>}
          </div>
          <Button size="sm" variant="ghost" onClick={() => remove(m.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Invitations panel (reused)
// ─────────────────────────────────────────────────────────────────────────────
export function InvitationsPanel({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const list = useSchoolInvitations(schoolId);
  const create = useCreateInvitation();
  const revoke = useRevokeInvitation();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<SchoolRole>("school_student");
  const [message, setMessage] = useState("");

  const send = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({ school_id: schoolId, email: trimmed, role, message: message || undefined });
      setEmail(""); setMessage("");
      toast({ title: "Invitation created", description: "Share the link with the invitee." });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: url });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" /><h3 className="font-medium">Invite a member</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input placeholder="email@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select value={role} onValueChange={(v) => setRole(v as SchoolRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="school_student">Student</SelectItem>
              <SelectItem value="school_teacher">Teacher</SelectItem>
              <SelectItem value="school_admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={send} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />} Send invite
          </Button>
        </div>
        <Textarea placeholder="Optional welcome message" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
      </Card>

      {list.isLoading ? (
        <div className="text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Loading…</div>
      ) : !list.data?.length ? (
        <Card className="p-8 text-center text-muted-foreground">No invitations yet.</Card>
      ) : (
        <Card className="divide-y">
          {list.data.map((i) => (
            <div key={i.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{i.email}</span>
                  <Badge variant="outline">{roleLabel[i.role]}</Badge>
                  <Badge variant={i.status === "pending" ? "secondary" : "outline"}>{i.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(i.expires_at).toLocaleDateString()} · Created {new Date(i.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {i.status === "pending" && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => copyLink(i.token)}>
                      <ShieldCheck className="h-4 w-4 mr-1" /> Copy link
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
