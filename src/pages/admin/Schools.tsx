/**
 * Super admin: list of all schools with create/search/filter.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Building2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminSchools, useCreateSchool, type SchoolPlan, type SchoolStatus,
} from "@/hooks/useSchools";

const statusVariant: Record<SchoolStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  trial: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  suspended: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  archived: "bg-muted text-muted-foreground border-border",
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export default function AdminSchools() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SchoolStatus | "">("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", contact_person: "", contact_email: "", country: "",
    plan: "trial" as SchoolPlan, seats_teachers: 10, seats_students: 200,
  });

  const list = useAdminSchools({ search: search || undefined, status: (status || undefined) as SchoolStatus | undefined });
  const create = useCreateSchool();

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    try {
      const school = await create.mutateAsync({
        ...form,
        slug: form.slug || slugify(form.name),
      });
      toast({ title: "School created", description: school.name });
      setOpen(false);
      setForm({ name: "", slug: "", contact_person: "", contact_email: "", country: "", plan: "trial", seats_teachers: 10, seats_students: 200 });
    } catch (e: any) {
      toast({ title: "Could not create school", description: e.message, variant: "destructive" });
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
          <p className="text-sm text-muted-foreground">Manage tenant schools across the StudySync platform.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New school</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create school</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} maxLength={120} />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder="auto-generated" maxLength={60} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Contact person</Label>
                  <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} maxLength={120} />
                </div>
                <div>
                  <Label>Contact email</Label>
                  <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} maxLength={255} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Country</Label>
                  <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} maxLength={80} />
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Teacher seats</Label>
                  <Input type="number" min={0} value={form.seats_teachers} onChange={(e) => setForm({ ...form, seats_teachers: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Student seats</Label>
                  <Input type="number" min={0} value={form.seats_students} onChange={(e) => setForm({ ...form, seats_students: Number(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search schools..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : (v as SchoolStatus))}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {list.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading schools…
        </div>
      ) : !list.data?.length ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-60" />
          No schools yet. Create one to get started.
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.data.map((s) => (
            <Link key={s.id} to={`/admin/schools/${s.id}`}>
              <Card className="p-4 hover:bg-muted/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium truncate">{s.name}</h3>
                      <Badge variant="outline" className={statusVariant[s.status]}>{s.status}</Badge>
                      <Badge variant="secondary" className="capitalize">{s.plan}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      /{s.slug}{s.country ? ` · ${s.country}` : ""} · {s.seats_teachers} teachers · {s.seats_students} students
                    </p>
                    {s.contact_email && <p className="text-xs text-muted-foreground mt-0.5">{s.contact_email}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
