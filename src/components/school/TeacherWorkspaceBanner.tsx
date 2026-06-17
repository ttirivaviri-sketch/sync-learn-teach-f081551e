/**
 * TeacherWorkspaceBanner — shown on the tutor app home for users who are
 * also teachers/admins at a school. Links to the teacher workspace where
 * they manage classes (materials, homework incl. AI homework, quizzes,
 * announcements, students) and provides quick-action shortcuts.
 */
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, School as SchoolIcon, Megaphone, FileText, ClipboardList } from "lucide-react";
import { useMySchoolMemberships } from "@/hooks/useSchools";

export function TeacherWorkspaceBanner() {
  const navigate = useNavigate();
  const { data } = useMySchoolMemberships();

  const teaching = (data ?? []).find(
    (m) => m.membership.role === "school_teacher" || m.membership.role === "school_admin"
  );
  if (!teaching) return null;

  const isTeacher = teaching.membership.role === "school_teacher";
  const target = isTeacher
    ? `/school/${teaching.school.id}/teach`
    : `/school/${teaching.school.id}`;

  const quick = (action: "announce" | "materials" | "homework") => (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/school/${teaching.school.id}/teach?action=${action}`);
  };

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
      <button
        onClick={() => navigate(target)}
        className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 transition"
      >
        <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <SchoolIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">My Workspace</div>
          <div className="text-xs text-muted-foreground truncate">
            {teaching.school.name} · classes, AI homework, materials & quizzes
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {isTeacher && (
        <div className="px-3 pb-3 grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={quick("announce")}>
            <Megaphone className="h-3.5 w-3.5 mr-1" /> Post
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={quick("materials")}>
            <FileText className="h-3.5 w-3.5 mr-1" /> Upload
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={quick("homework")}>
            <ClipboardList className="h-3.5 w-3.5 mr-1" /> Homework
          </Button>
        </div>
      )}
    </Card>
  );
}
