/**
 * SchoolAdminPage — /school entry point. Redirects the user to the first
 * school they administer (or teach in), reusing SchoolDashboard. Adapted
 * from the iScanner bundle.
 */
import { Navigate } from "react-router-dom";
import { LoadingScreen } from "@/components/LoadingSpinner";
import { useMySchoolMemberships } from "@/hooks/useSchools";

export default function SchoolAdminPage() {
  const { data, isLoading } = useMySchoolMemberships();
  if (isLoading) return <LoadingScreen />;
  const rows = data ?? [];
  const admin = rows.find((r) => r.membership.role === "school_admin") ?? rows[0];
  if (!admin) return <Navigate to="/learner" replace />;
  return <Navigate to={`/school/${admin.school.id}`} replace />;
}
