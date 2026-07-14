/**
 * SchoolAdminPage — /school entry point.
 *
 * Resolution order:
 * 1. If the user belongs to a classic school (`schools` system), redirect to
 *    that school's dashboard (`/school/:id`), preferring an admin membership.
 * 2. Otherwise, if the user holds a staff role in a Learning OS workspace
 *    (`learning_workspace_memberships`), render the LOS School Admin Console
 *    in place so the workspace admin surface is reachable.
 * 3. Otherwise, fall back to the learner app.
 */
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/LoadingSpinner";
import { useMySchoolMemberships } from "@/hooks/useSchools";
import { useLosWorkspaceMembership } from "@/studymode/hooks/useLosWorkspaceMembership";
import { SchoolAdminConsole } from "@/studymode/components/SchoolAdminConsole";

const LOS_STAFF_ROLES = ["owner", "admin", "teacher"];

export default function SchoolAdminPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useMySchoolMemberships();
  const { isLoading: losLoading, membership: losMembership } =
    useLosWorkspaceMembership(LOS_STAFF_ROLES);

  if (isLoading || losLoading) return <LoadingScreen />;

  const rows = data ?? [];
  const admin = rows.find((r) => r.membership.role === "school_admin") ?? rows[0];
  if (admin) return <Navigate to={`/school/${admin.school.id}`} replace />;

  if (losMembership) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-lg">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-base font-bold text-foreground">School Admin Console</h1>
              <p className="text-xs text-muted-foreground">Learning OS workspace</p>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-6">
          <SchoolAdminConsole />
        </main>
      </div>
    );
  }

  return <Navigate to="/learner" replace />;
}
