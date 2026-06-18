/**
 * CreateClassroomDialog — one-shot wizard that creates a class and seeds
 * its subject/teacher assignment plus a roster of students. Used by both
 * the school admin Academic page and the Teacher Workspace so teachers and
 * admins build a "closed ecosystem" in a single step.
 *
 * Permissions: backed by RLS on `classes`, `class_subjects`, and `enrollments`.
 * Admins can create any class; teachers can create a class and (because the
 * INSERT they make assigns themselves as the subject teacher) will then own
 * follow-up edits to that classroom.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useGrades, useSchoolSubjects,
  useUpsertClass, useUpsertClassSubject, useCreateEnrollment,
  findUserIdByEmail,
} from "@/hooks/useSchoolAcademics";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  schoolId: string;
  /** When provided, the teacher's user id is used as default subject teacher. */
  defaultTeacherId?: string;
  trigger?: React.ReactNode;
  onCreated?: (classId: string) => void;
}

export function CreateClassroomDialog({ schoolId, defaultTeacherId, trigger, onCreated }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const grades = useGrades(schoolId);
  const subjects = useSchoolSubjects(schoolId);
  const upsertClass = useUpsertClass();
  const upsertClassSubject = useUpsertClassSubject();
  const enroll = useCreateEnrollment();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [students, setStudents] = useState("");
  const [busy, setBusy] = useState(false);

  const teacherDefault = defaultTeacherId ?? user?.id ?? null;

  function reset() {
    setName(""); setGradeId(""); setSubjectId("");
    setTeacherEmail(""); setStudents("");
  }

  async function submit() {
    if (!name.trim()) { toast.error("Give the classroom a name"); return; }
    if (!subjectId) { toast.error("Pick a subject"); return; }
    setBusy(true);
    try {
      // 1. Resolve teacher
      let teacherId: string | null = teacherDefault;
      if (teacherEmail.trim()) {
        teacherId = await findUserIdByEmail(teacherEmail.trim());
        if (!teacherId) throw new Error(`No user found for ${teacherEmail}`);
      }

      // 2. Create class
      const cls = await upsertClass.mutateAsync({
        school_id: schoolId,
        name: name.trim(),
        grade_id: gradeId || null,
      } as any);

      // 3. Assign subject + teacher
      await upsertClassSubject.mutateAsync({
        school_id: schoolId,
        class_id: cls.id,
        subject_id: subjectId,
        teacher_id: teacherId,
      });

      // 4. Bulk enroll students by email
      const emails = students
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      let enrolled = 0;
      const skipped: string[] = [];
      for (const email of emails) {
        const id = await findUserIdByEmail(email);
        if (!id) { skipped.push(email); continue; }
        try {
          await enroll.mutateAsync({ school_id: schoolId, class_id: cls.id, student_id: id });
          enrolled += 1;
        } catch {
          skipped.push(email);
        }
      }

      toast.success(
        `Classroom "${cls.name}" created${enrolled ? ` · ${enrolled} student${enrolled === 1 ? "" : "s"} enrolled` : ""}`
      );
      if (skipped.length) {
        toast.warning(`Couldn't enroll: ${skipped.join(", ")}`, {
          description: "These emails don't match a registered learner. Invite them first.",
        });
      }
      onCreated?.(cls.id);
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Could not create classroom");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus className="h-4 w-4 mr-1" />New classroom</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a classroom</DialogTitle>
          <p className="text-sm text-muted-foreground">
            One closed space for a subject, grade, teacher and a roster of students.
          </p>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Classroom name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Form 4 — Mathematics" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Grade</Label>
              <Select value={gradeId} onValueChange={setGradeId}>
                <SelectTrigger><SelectValue placeholder={grades.data?.length ? "Pick a grade" : "No grades yet"} /></SelectTrigger>
                <SelectContent>
                  {grades.data?.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder={subjects.data?.length ? "Pick a subject" : "No subjects yet"} /></SelectTrigger>
                <SelectContent>
                  {subjects.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Teacher email <span className="text-muted-foreground font-normal">(blank = you)</span></Label>
            <Input
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              placeholder="teacher@school.com"
              type="email"
            />
          </div>

          <div>
            <Label>Students</Label>
            <Textarea
              rows={4}
              value={students}
              onChange={(e) => setStudents(e.target.value)}
              placeholder="Paste student emails, separated by commas or new lines."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Students must already have an account at your school. Invite new learners from <em>School &rsaquo; Members</em>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Create classroom
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
