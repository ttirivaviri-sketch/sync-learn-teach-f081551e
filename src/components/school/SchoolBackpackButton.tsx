/**
 * SchoolBackpackButton — top-bar entry point to My School.
 *
 * Per the UI spec, My School is reached through a backpack icon next to the
 * notification bell (header icon, not a 6th nav tab). The badge counts
 * homework/quizzes due plus recent announcements. Renders nothing when the
 * learner has no student membership of any school.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Backpack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMySchoolMemberships } from "@/hooks/useSchools";
import { useStudentTodayFeed, useAnnouncements } from "@/hooks/useSchoolAcademics";
import { FEATURE_SCHOOLS } from "@/lib/featureFlags";

export function SchoolBackpackButton() {
  const navigate = useNavigate();
  const memberships = useMySchoolMemberships();

  const studentMembership = useMemo(
    () =>
      (memberships.data ?? []).find(
        (m) => m.membership.role === "school_student"
      ),
    [memberships.data]
  );

  const schoolId = studentMembership?.school.id;
  const today = useStudentTodayFeed(schoolId);
  const announcements = useAnnouncements({ schoolId });

  if (!FEATURE_SCHOOLS || !studentMembership) return null;

  const dueCount =
    (today.data?.assignments.length ?? 0) + (today.data?.quizzes.length ?? 0);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentAnnouncements = (announcements.data ?? []).filter(
    (a: any) => new Date(a.created_at).getTime() > weekAgo
  ).length;
  const badgeCount = dueCount + recentAnnouncements;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate(`/school/${schoolId}/learn`)}
      className="relative h-9 w-9 rounded-full p-0 text-white hover:bg-white/15"
      aria-label={`My School${badgeCount > 0 ? ` — ${badgeCount} items need attention` : ""}`}
    >
      <Backpack className="h-5 w-5" />
      {badgeCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
    </Button>
  );
}
