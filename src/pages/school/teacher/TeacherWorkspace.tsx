/**
 * Teacher workspace: list of classes the user teaches, with click-through
 * to a per-class detail view (materials, assignments, quizzes, announcements,
 * students). Supports the `?action=` query string from the tutor home
 * "My Workspace" quick-action shortcuts — when the user has just one class
 * we deep-link them straight to the right tab.
 */
import { useEffect } from "react";
import { useOutletContext, useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Loader2, BookOpenCheck, Megaphone, FileText, ClipboardList } from "lucide-react";
import { useMyTeachingClasses } from "@/hooks/useSchoolAcademics";
import { CreateClassroomDialog } from "@/components/school/CreateClassroomDialog";

const ACTION_TO_TAB: Record<string, string> = {
  announce: "stream",
  materials: "materials",
  homework: "homework",
};

const ACTION_LABEL: Record<string, { icon: any; label: string }> = {
  announce: { icon: Megaphone, label: "post an announcement" },
  materials: { icon: FileText, label: "upload materials" },
  homework: { icon: ClipboardList, label: "set homework" },
};

export default function TeacherWorkspace() {
  const { school } = useOutletContext<{ school: any }>();
  const classes = useMyTeachingClasses(school.id);
  const nav = useNavigate();
  const [search] = useSearchParams();
  const action = search.get("action") ?? "";
  const tab = ACTION_TO_TAB[action];

  // If the user came from a quick action and has exactly one class, jump
  // straight to that class on the right tab.
  useEffect(() => {
    if (!tab) return;
    const list = classes.data;
    if (list && list.length === 1) {
      nav(`/school/${school.id}/teach/${list[0].id}?tab=${tab}`, { replace: true });
    }
  }, [tab, classes.data, school.id, nav]);

  if (classes.isLoading) return <p className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading classes…</p>;

  const meta = action ? ACTION_LABEL[action] : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My classes</h1>
        <p className="text-sm text-muted-foreground">Classes you teach or are the homeroom for.</p>
      </div>

      {meta && (classes.data?.length ?? 0) > 1 && (
        <Card className="p-3 flex items-center gap-2 border-primary/30 bg-primary/5 text-sm">
          <meta.icon className="h-4 w-4 text-primary" />
          <span>Pick a class to {meta.label}.</span>
        </Card>
      )}

      {classes.data?.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          You aren't assigned to any classes yet. Ask your school admin to assign you a subject in a class.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {classes.data?.map((c) => (
            <Card
              key={c.id}
              role="button"
              onClick={() => nav(`/school/${school.id}/teach/${c.id}${tab ? `?tab=${tab}` : ""}`)}
              className="p-4 cursor-pointer hover:bg-muted/40 transition"
            >
              <BookOpenCheck className="h-5 w-5 text-primary mb-2" />
              <h3 className="font-semibold">{c.name}</h3>
              <p className="text-xs text-muted-foreground">Class</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
