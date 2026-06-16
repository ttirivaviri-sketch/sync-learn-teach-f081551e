/**
 * School admin portal layout. Authenticated users with at least one active
 * `school_admin` membership can access it. The currently active school is
 * selected via the URL: /school/:schoolId.
 */
import { useEffect, useState } from "react";
import { Outlet, Link, NavLink, useNavigate, useParams, Navigate } from "react-router-dom";
import { Loader2, LayoutDashboard, Users, Mail, Settings as SettingsIcon, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMySchoolMemberships } from "@/hooks/useSchools";
import { Card } from "@/components/ui/card";

export default function SchoolLayout() {
  const navigate = useNavigate();
  const { schoolId } = useParams();
  const [authChecked, setAuthChecked] = useState(false);
  const memberships = useMySchoolMemberships();

  useEffect(() => {
    document.title = "School Admin | StudySync";
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) navigate("/learner/auth?next=/school", { replace: true });
      setAuthChecked(true);
    })();
  }, [navigate]);

  if (!authChecked || memberships.isLoading) {
    return <main className="min-h-[60vh] flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading school portal…</main>;
  }

  const adminMemberships = (memberships.data ?? []).filter((m) => m.membership.role === "school_admin");

  if (!adminMemberships.length) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <Building2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
          <h1 className="text-lg font-semibold">No school access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You aren't a school admin yet. Ask your school administrator to invite you,
            or contact StudySync support.
          </p>
          <Link to="/" className="inline-block mt-4 text-sm underline">Back to home</Link>
        </Card>
      </main>
    );
  }

  // Pick default school
  if (!schoolId) {
    return <Navigate to={`/school/${adminMemberships[0].school.id}`} replace />;
  }
  const current = adminMemberships.find((m) => m.school.id === schoolId);
  if (!current) {
    return <Navigate to={`/school/${adminMemberships[0].school.id}`} replace />;
  }

  const tabs = [
    { label: "Overview", to: `/school/${schoolId}`, icon: LayoutDashboard, end: true },
    { label: "Members", to: `/school/${schoolId}/members`, icon: Users },
    { label: "Invitations", to: `/school/${schoolId}/invitations`, icon: Mail },
    { label: "Settings", to: `/school/${schoolId}/settings`, icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="shrink-0">
              <img src="/lovable-uploads/studysync-logo.png" alt="StudySync" className="h-10 object-contain" />
            </Link>
            <div className="hidden sm:block min-w-0">
              <p className="text-xs text-muted-foreground">School portal</p>
              <p className="text-sm font-medium truncate">{current.school.name}</p>
            </div>
          </div>
          {adminMemberships.length > 1 && (
            <select
              className="text-sm border rounded-md px-2 py-1 bg-background"
              value={schoolId}
              onChange={(e) => navigate(`/school/${e.target.value}`)}
            >
              {adminMemberships.map((m) => (
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
                `flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                  isActive ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="p-6">
        <Outlet context={{ school: current.school }} />
      </main>
    </div>
  );
}
