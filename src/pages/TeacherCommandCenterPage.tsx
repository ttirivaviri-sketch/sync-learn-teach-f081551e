/**
 * TeacherCommandCenterPage — /teacher entry point. Redirects to the first
 * school where the current user holds a teacher/admin membership. Adapted
 * from the iScanner bundle to reuse TeacherWorkspace instead of introducing
 * a duplicate command-centre UI.
 */
import { Navigate } from "react-router-dom";
import { LoadingScreen } from "@/components/LoadingSpinner";
import { useMySchoolMemberships } from "@/hooks/useSchools";

export default function TeacherCommandCenterPage() {
  const { data, isLoading } = useMySchoolMemberships();
  if (isLoading) return <LoadingScreen />;
  const teacher = (data ?? []).find(
    (r) => r.membership.role === "school_teacher" || r.membership.role === "school_admin",
  );
  if (!teacher) return <Navigate to="/tutor" replace />;
  return <Navigate to={`/school/${teacher.school.id}/teach`} replace />;
}
