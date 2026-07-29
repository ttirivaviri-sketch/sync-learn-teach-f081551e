/**
 * SchoolOnboardingWizard — live setup checklist for new school admins.
 *
 * Replaces the static "Getting started" card. Each step checks real data
 * (grades, subjects, classes, teacher/student invites, homework) and deep-
 * links to the page where the admin completes it. The card collapses to a
 * one-line "setup complete" state once everything is done, and hides
 * entirely after that for schools with real activity.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronRight, Circle, Rocket } from "lucide-react";
import { useGrades, useSchoolSubjects, useClasses } from "@/hooks/useSchoolAcademics";
import { useSchoolMemberships, useSchoolInvitations } from "@/hooks/useSchools";

interface Props {
  schoolId: string;
}

export function SchoolOnboardingWizard({ schoolId }: Props) {
  const grades = useGrades(schoolId);
  const subjects = useSchoolSubjects(schoolId);
  const classes = useClasses(schoolId);
  const members = useSchoolMemberships(schoolId);
  const invitations = useSchoolInvitations(schoolId);

  const { data: homeworkCount } = useQuery({
    queryKey: ["school-homework-count", schoolId],
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase
        .from("school_homework")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId);
      return count ?? 0;
    },
  });

  const memberList = members.data ?? [];
  const inviteList = invitations.data ?? [];
  const hasTeachers =
    memberList.some((m) => m.role === "school_teacher") ||
    inviteList.some((i) => i.role === "school_teacher");
  const hasStudents =
    memberList.some((m) => m.role === "school_student") ||
    inviteList.some((i) => i.role === "school_student");

  const base = `/school/${schoolId}`;
  const steps = [
    {
      label: "Add your grade levels",
      detail: "e.g. Form 1–4 or Grade 8–12",
      done: (grades.data?.length ?? 0) > 0,
      to: `${base}/academic`,
    },
    {
      label: "Add subjects",
      detail: "the subjects your school teaches",
      done: (subjects.data?.length ?? 0) > 0,
      to: `${base}/academic`,
    },
    {
      label: "Create classes",
      detail: "e.g. 4A Mathematics",
      done: (classes.data?.length ?? 0) > 0,
      to: `${base}/academic`,
    },
    {
      label: "Invite teachers",
      detail: "they'll get an email with a join link",
      done: hasTeachers,
      to: `${base}/invitations`,
    },
    {
      label: "Invite students",
      detail: "bulk invites supported",
      done: hasStudents,
      to: `${base}/invitations`,
    },
    {
      label: "Set your first homework",
      detail: "teachers can generate AI homework per class",
      done: (homeworkCount ?? 0) > 0,
      to: `${base}/teach`,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const stillLoading = grades.isLoading || members.isLoading;

  if (stillLoading) return null;

  if (allDone) {
    return (
      <Card className="p-4 flex items-center gap-3 border-emerald-500/30 bg-emerald-500/[0.04]">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <p className="text-sm">
          <span className="font-medium">Setup complete.</span>{" "}
          <span className="text-muted-foreground">
            Your school is fully configured — track progress under Analytics.
          </span>
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          <h2 className="font-medium">School setup</h2>
        </div>
        <Badge variant="secondary">
          {doneCount}/{steps.length} done
        </Badge>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }}
        />
      </div>
      <div className="space-y-1">
        {steps.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className={`flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 transition-colors ${
              s.done ? "opacity-60" : "hover:bg-muted/60"
            }`}
          >
            {s.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${s.done ? "line-through" : "font-medium"}`}>
                {s.label}
              </p>
              {!s.done && (
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              )}
            </div>
            {!s.done && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </Link>
        ))}
      </div>
    </Card>
  );
}
