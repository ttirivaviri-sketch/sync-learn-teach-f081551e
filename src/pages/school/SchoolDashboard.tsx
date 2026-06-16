import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Users, Mail, GraduationCap, ShieldCheck } from "lucide-react";
import { useSchoolMemberships, useSchoolInvitations, type School } from "@/hooks/useSchools";

export default function SchoolDashboard() {
  const { school } = useOutletContext<{ school: School }>();
  const members = useSchoolMemberships(school.id);
  const invitations = useSchoolInvitations(school.id);

  const teachers = (members.data ?? []).filter((m) => m.role === "school_teacher").length;
  const students = (members.data ?? []).filter((m) => m.role === "school_student").length;
  const admins = (members.data ?? []).filter((m) => m.role === "school_admin").length;
  const pending = (invitations.data ?? []).filter((i) => i.status === "pending").length;

  const stats = [
    { label: "Teachers", value: teachers, icon: Users, sub: `of ${school.seats_teachers} seats` },
    { label: "Students", value: students, icon: GraduationCap, sub: `of ${school.seats_students} seats` },
    { label: "Admins", value: admins, icon: ShieldCheck, sub: "active" },
    { label: "Pending invites", value: pending, icon: Mail, sub: "awaiting response" },
  ];

  return (
    <section className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-semibold">{school.name}</h1>
        <p className="text-sm text-muted-foreground">
          {school.plan.toUpperCase()} · {school.status} · /{school.slug}
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-semibold mt-1">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.sub}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="font-medium mb-1">Getting started</h2>
        <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
          <li>Invite teachers and students from the <span className="text-foreground">Invitations</span> tab.</li>
          <li>Manage active members and roles in <span className="text-foreground">Members</span>.</li>
          <li>Update school branding, contact, and contract under <span className="text-foreground">Settings</span>.</li>
        </ol>
      </Card>
    </section>
  );
}
