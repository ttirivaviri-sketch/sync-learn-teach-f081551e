/**
 * School portal layout. Anyone with an active membership of the school
 * (admin/teacher/student) can access it. Tabs are filtered by role.
 */
import { useEffect, useState } from "react";
import { Outlet, Link, NavLink, useNavigate, useParams, Navigate } from "react-router-dom";
import { Loader2, LayoutDashboard, Users, Mail, Settings as SettingsIcon, Building2, GraduationCap, BookOpenCheck, Megaphone, Backpack, BarChart3, ShieldAlert, Clock3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMySchoolMemberships } from "@/hooks/useSchools";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FEATURE_SCHOOLS } from "@/lib/featureFlags";
import { evaluateSchoolContract, isContractLive, contractMessage, BILLING_CONTACT_EMAIL } from "@/lib/schoolContract";

export default function SchoolLayout() {
  const navigate = useNavigate();
  const { schoolId } = useParams();
  const [authChecked, setAuthChecked] = useState(false);
  const memberships = useMySchoolMemberships();

  useEffect(() => {
    document.title = "School | StudySync";
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) navigate("/learner/auth?next=/school", { replace: true });
      setAuthChecked(true);
    })();
  }, [navigate]);

  // P8: Feature flag gate — if schools are disabled in this environment,
  // pretend the portal does not exist at all.
  if (!FEATURE_SCHOOLS) return <Navigate to="/404" replace />;

  if (!authChecked || memberships.isLoading) {
    return <main className="min-h-[60vh] flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading school portal…</main>;
  }

  const all = memberships.data ?? [];

  if (!all.length) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <Building2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
          <h1 className="text-lg font-semibold">No school access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You aren't a member of any school yet. Ask your school administrator to invite you.
          </p>
          <Link to="/" className="inline-block mt-4 text-sm underline">Back to home</Link>
        </Card>
      </main>
    );
  }

  if (!schoolId) return <Navigate to={`/school/${all[0].school.id}`} replace />;
  const current = all.find((m) => m.school.id === schoolId);
  if (!current) return <Navigate to={`/school/${all[0].school.id}`} replace />;

  const role = current.membership.role;
  const isAdmin = role === "school_admin";
  const isTeacher = role === "school_teacher" || isAdmin;
  const isStudent = role === "school_student";

  // P8: Contract / billing gate. Suspended, archived, expired and
  // not-yet-started schools are hard-blocked. Settings stays reachable
  // for school admins so they can still see billing info.
  const gate = evaluateSchoolContract(current.school);
  const live = isContractLive(gate);
  if (!live) {
    const msg = contractMessage(gate);
    return (
      <main className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <ShieldAlert className="h-10 w-10 mx-auto mb-2 text-destructive" />
          <h1 className="text-lg font-semibold">{msg.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{msg.body}</p>
          <p className="text-xs text-muted-foreground mt-3">{current.school.name} · plan {current.school.plan}</p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            <Button asChild size="sm" variant="default">
              <a href={`mailto:${BILLING_CONTACT_EMAIL}?subject=${encodeURIComponent(`Restore access — ${current.school.name}`)}`}>Contact billing</a>
            </Button>
            {isAdmin && (
              <Button asChild size="sm" variant="outline">
                <Link to={`/school/${schoolId}/settings`}>Open settings</Link>
              </Button>
            )}
            <Button asChild size="sm" variant="ghost"><Link to="/">Back home</Link></Button>
          </div>
        </Card>
      </main>
    );
  }

  const tabs = [
    { label: "Overview", to: `/school/${schoolId}`, icon: LayoutDashboard, end: true, show: true },
    { label: "Members", to: `/school/${schoolId}/members`, icon: Users, show: isAdmin },
    { label: "Academic", to: `/school/${schoolId}/academic`, icon: GraduationCap, show: isAdmin },
    { label: "Teach", to: `/school/${schoolId}/teach`, icon: BookOpenCheck, show: isTeacher },
    { label: "My classes", to: `/school/${schoolId}/learn`, icon: Backpack, show: isStudent },
    { label: "Announcements", to: `/school/${schoolId}/announcements`, icon: Megaphone, show: true },
    { label: "Analytics", to: `/school/${schoolId}/analytics`, icon: BarChart3, show: isTeacher },
    { label: "Invitations", to: `/school/${schoolId}/invitations`, icon: Mail, show: isAdmin },
    { label: "Settings", to: `/school/${schoolId}/settings`, icon: SettingsIcon, show: isAdmin },
  ].filter((t) => t.show);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="shrink-0">
              <img src="/lovable-uploads/studysync-logo.png" alt="StudySync" className="h-10 object-contain" />
            </Link>
            <div className="hidden sm:block min-w-0">
              <p className="text-xs text-muted-foreground">{role.replace("school_","").replace("_"," ")}</p>
              <p className="text-sm font-medium truncate">{current.school.name}</p>
            </div>
          </div>
          {all.length > 1 && (
            <select
              className="text-sm border rounded-md px-2 py-1 bg-background"
              value={schoolId}
              onChange={(e) => navigate(`/school/${e.target.value}`)}
            >
              {all.map((m) => (
                <option key={m.school.id} value={m.school.id}>{m.school.name}</option>
              ))}
            </select>
          )}
        </div>
        <nav className="px-4 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  isActive ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="p-4 md:p-6">
        <Outlet context={{ school: current.school, role }} />
      </main>
    </div>
  );
}
