/**
 * Teacher workspace: list of classes the user teaches, with click-through
 * to a per-class detail view (materials, assignments, quizzes, announcements,
 * students).
 */
import { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Loader2, BookOpenCheck } from "lucide-react";
import { useMyTeachingClasses } from "@/hooks/useSchoolAcademics";

export default function TeacherWorkspace() {
  const { school } = useOutletContext<{ school: any }>();
  const classes = useMyTeachingClasses(school.id);
  const nav = useNavigate();

  if (classes.isLoading) return <p className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading classes…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My classes</h1>
        <p className="text-sm text-muted-foreground">Classes you teach or are the homeroom for.</p>
      </div>
      {classes.data?.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          You aren't assigned to any classes yet. Ask your school admin to assign you a subject in a class.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {classes.data?.map((c) => (
            <Card key={c.id} role="button" onClick={() => nav(`/school/${school.id}/teach/${c.id}`)} className="p-4 cursor-pointer hover:bg-muted/40 transition">
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
