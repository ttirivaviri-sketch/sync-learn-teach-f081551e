/**
 * TeacherCommandCenterPage — /teacher entry point.
 *
 * Resolution order:
 * 1. If the user teaches/administers a classic school (`schools` system),
 *    redirect to that school's teach surface (`/school/:id/teach`).
 * 2. Otherwise, if the user holds a staff role in a Learning OS workspace
 *    (`learning_workspace_memberships`), render the LOS Teacher Command
 *    Center in place so the workspace surface is reachable.
 * 3. Otherwise, fall back to the tutor dashboard.
 */
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/LoadingSpinner";
import { useMySchoolMemberships } from "@/hooks/useSchools";
import { useLosWorkspaceMembership } from "@/studymode/hooks/useLosWorkspaceMembership";
import { TeacherCommandCenter } from "@/studymode/components/TeacherCommandCenter";

const LOS_STAFF_ROLES = ["owner", "admin", "teacher"];

export default function TeacherCommandCenterPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useMySchoolMemberships();
  const { isLoading: losLoading, membership: losMembership } =
    useLosWorkspaceMembership(LOS_STAFF_ROLES);

  if (isLoading || losLoading) return <LoadingScreen />;

  const teacher = (data ?? []).find(
    (r) => r.membership.role === "school_teacher" || r.membership.role === "school_admin",
  );
  if (teacher) return <Navigate to={`/school/${teacher.school.id}/teach`} replace />;

  if (losMembership) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-lg">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-base font-bold text-foreground">Teacher Command Center</h1>
              <p className="text-xs text-muted-foreground">Learning OS workspace</p>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-6">
          <TeacherCommandCenter />
        </main>
      </div>
    );
  }

  return <Navigate to="/tutor" replace />;
}
